import { postGemini, responseText, type GeminiConfig } from './gemini'
import { localDate } from './storage'

export type EventType = '1+1' | '할인' | '적립' | '증정' | '기타'

export interface BrandEvent {
  id: string
  brand: string
  title: string
  /** 표시용 기간 (예: "2026-10-01~2026-10-31"), 모르면 '' */
  period: string
  type: EventType
  summary: string
  /** 출처 URL, 없으면 '' */
  url: string
}

export interface EventFeed {
  events: BrandEvent[]
  /** 응답에서 수집한 출처 (검색 그라운딩) */
  sources: { uri: string; title: string }[]
  /** Google 검색 제안 HTML (그라운딩 이용 조건상 표시) */
  searchEntryHtml?: string
  fetchedAt: number
  /** 'ai' = Gemini 검색, 'sample' = 예시 데이터 */
  origin: 'ai' | 'sample'
  key: string
}

const TYPES: EventType[] = ['1+1', '할인', '적립', '증정', '기타']
export const FEED_TTL_MS = 6 * 60 * 60_000

function isBrandEvent(v: unknown): v is BrandEvent {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.brand === 'string' &&
    typeof o.title === 'string' &&
    typeof o.period === 'string' &&
    typeof o.summary === 'string' &&
    typeof o.url === 'string' &&
    TYPES.includes(o.type as EventType)
  )
}

export function isEventFeed(v: unknown): v is EventFeed {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Partial<EventFeed>
  return (
    Array.isArray(o.events) &&
    o.events.every(isBrandEvent) &&
    Array.isArray(o.sources) &&
    typeof o.fetchedAt === 'number' &&
    typeof o.key === 'string' &&
    (o.searchEntryHtml === undefined || typeof o.searchEntryHtml === 'string')
  )
}

/** 키 없음·실패 시 보여줄 예시 (실제 행사 아님 — 화면에 '예시' 표시) */
export function sampleEvents(brands: string[]): EventFeed {
  const all: Omit<BrandEvent, 'id'>[] = [
    { brand: 'CU', title: '음료 1+1 행사 상품 모음', period: '', type: '1+1', summary: '편의점 음료·과자 일부 품목 1+1 (예시)', url: '' },
    { brand: 'GS25', title: '도시락 구매 시 음료 증정', period: '', type: '증정', summary: '간편식 구매 시 지정 음료 증정 (예시)', url: '' },
    { brand: '스타벅스', title: '시즌 음료 별 추가 적립', period: '', type: '적립', summary: '시즌 음료 주문 시 별 추가 적립 (예시)', url: '' },
    { brand: '올리브영', title: '올영세일 최대 50% 할인', period: '', type: '할인', summary: '스킨케어·색조 인기 상품 할인 (예시)', url: '' },
    { brand: '메가커피', title: '앱 주문 아메리카노 할인', period: '', type: '할인', summary: '앱 스탬프 적립 시 할인 쿠폰 (예시)', url: '' },
    { brand: '다이소', title: '신학기 문구 기획전', period: '', type: '기타', summary: '문구·수납 기획 상품 모음 (예시)', url: '' },
    { brand: '세븐일레븐', title: '삼각김밥 2+1', period: '', type: '1+1', summary: '지정 삼각김밥 묶음 행사 (예시)', url: '' },
    { brand: '배스킨라빈스', title: '파인트 구매 시 사이즈업', period: '', type: '증정', summary: '파인트 주문 시 쿼터 사이즈업 (예시)', url: '' },
  ]
  const preferred = all.filter((e) => brands.includes(e.brand))
  const rest = all.filter((e) => !brands.includes(e.brand))
  return {
    events: [...preferred, ...rest].map((e, i) => ({ ...e, id: `sample-${i}` })),
    sources: [],
    fetchedAt: Date.now(),
    origin: 'sample',
    key: brands.join('|'),
  }
}

function extractJsonArray(text: string): unknown {
  // 코드펜스 안을 우선 (본문의 [1] 같은 인용 표기와 섞이지 않게)
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1]
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('이벤트 목록을 찾지 못했습니다.')
  return JSON.parse(text.slice(start, end + 1)) as unknown
}

function toEvent(v: unknown, i: number, brands: string[]): BrandEvent | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
  const brand = str('brand')
  const title = str('title')
  if (!brand || !title) return null
  const type = TYPES.includes(str('type') as EventType) ? (str('type') as EventType) : '기타'
  const url = /^https?:\/\//.test(str('url')) ? str('url') : ''
  return {
    id: `ai-${i}`,
    brand: brands.find((b) => b.toLowerCase() === brand.toLowerCase()) ?? brand,
    title: title.slice(0, 40),
    period: str('period').slice(0, 30),
    type,
    summary: str('summary').slice(0, 80),
    url,
  }
}

/** Gemini + Google 검색으로 브랜드별 진행 중인 행사 수집 */
export async function fetchAiEvents(config: GeminiConfig, brands: string[]): Promise<EventFeed> {
  const prompt = [
    `오늘은 ${localDate()}이다. Google 검색으로 한국에서 현재 진행 중이거나 곧 시작하는 다음 브랜드의 할인·프로모션·이벤트를 찾아라.`,
    `브랜드: ${brands.join(', ')}`,
    '규칙:',
    '- 검색으로 확인되는 행사만. 확실하지 않거나 이미 끝난 행사는 제외.',
    '- 브랜드당 최대 2개, 전체 최대 12개.',
    '- 아래 형식의 JSON 배열만 출력하고 다른 설명은 쓰지 않는다.',
    '[{"brand":"목록에 있는 표기 그대로","title":"행사명 30자 이내","period":"YYYY-MM-DD~YYYY-MM-DD 또는 빈 문자열","type":"1+1|할인|적립|증정|기타 중 하나","summary":"핵심 내용 60자 이내","url":"출처 페이지 URL 또는 빈 문자열"}]',
  ].join('\n')
  const json = await postGemini(
    config,
    { contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } },
    30_000,
  )
  const raw = extractJsonArray(responseText(json))
  if (!Array.isArray(raw)) throw new Error('이벤트 형식이 올바르지 않습니다.')
  const meta = json.candidates?.[0]?.groundingMetadata
  const sources = (meta?.groundingChunks ?? [])
    .map((c) => ({ uri: c.web?.uri ?? '', title: c.web?.title ?? '' }))
    .filter((s) => s.uri)
    .slice(0, 10)
  const sourceUris = new Set(sources.map((s) => s.uri))
  const events = raw
    .map((v, i) => toEvent(v, i, brands))
    .filter((e): e is BrandEvent => e !== null)
    // 모델이 쓴 URL은 지어낸 주소일 수 있으므로 실제 검색 출처와 일치할 때만 링크로 사용
    .map((e) => (sourceUris.has(e.url) ? e : { ...e, url: '' }))
    .slice(0, 12)
  if (events.length === 0) throw new Error('진행 중인 행사를 찾지 못했습니다.')
  return {
    events,
    sources,
    searchEntryHtml: meta?.searchEntryPoint?.renderedContent || undefined,
    fetchedAt: Date.now(),
    origin: 'ai',
    key: brands.join('|'),
  }
}
