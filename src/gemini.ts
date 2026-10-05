import type { ArrivalMessage } from './message'
import { prioritize } from './message'
import { daysUntil, localDate } from './storage'
import type { Benefit } from './types'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 8_000

export interface GeminiConfig {
  apiKey: string
  model: string
}

function describe(b: Benefit): string {
  const kind = b.kind === 'coupon' ? '쿠폰' : '멤버십'
  const expiry = b.expiresAt ? `, 만료 ${daysUntil(b.expiresAt)}일 남음` : ''
  return `- [${kind}] ${b.brand}: ${b.title}${expiry}`
}

function buildPrompt(storeName: string, benefits: Benefit[]): string {
  return [
    '너는 사용자가 매장에서 멤버십·쿠폰을 잊지 않게 도와주는 스마트 지갑 비서다.',
    `사용자가 방금 "${storeName}" 매장에 도착했다. 오늘은 ${localDate()}이다.`,
    '이 매장에서 쓸 수 있는 사용자의 혜택 목록:',
    ...benefits.map(describe),
    '',
    '규칙:',
    '- 목록에 있는 혜택만 언급한다. 없는 할인·적립률을 지어내지 않는다.',
    '- 만료가 가까운 쿠폰을 먼저 권하고, 쿠폰과 멤버십을 함께 쓸 수 있으면 같이 쓰라고 안내한다.',
    '- title: 25자 이내, 매장 도착 사실과 핵심 혜택.',
    '- body: 90자 이내, 친근한 존댓말 1~2문장, 결제 전에 무엇을 꺼낼지 구체적으로.',
  ].join('\n')
}

export interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[]
      /** Google 검색 제안 HTML — 그라운딩 사용 시 화면 표시 필요 */
      searchEntryPoint?: { renderedContent?: string }
    }
  }[]
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

/** generateContent 저수준 호출. HTTP 오류·타임아웃은 예외 */
export async function postGemini(config: GeminiConfig, body: object, timeoutMs: number): Promise<GeminiResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const model = config.model.replace(/^models\//, '') || DEFAULT_GEMINI_MODEL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(`Gemini ${res.status}: ${err?.error?.message ?? res.statusText}`)
    }
    return (await res.json()) as GeminiResponse
  } finally {
    clearTimeout(timer)
  }
}

export function responseText(json: GeminiResponse): string {
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.')
  return text
}

/** JSON 스키마 모드로 호출 → 파싱 결과 반환 */
async function callGemini(
  config: GeminiConfig,
  parts: Part[],
  responseSchema: object,
  opts: { timeoutMs: number; temperature: number },
): Promise<unknown> {
  const json = await postGemini(
    config,
    {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: opts.temperature, responseMimeType: 'application/json', responseSchema },
    },
    opts.timeoutMs,
  )
  return JSON.parse(responseText(json)) as unknown
}

function isMessage(v: unknown): v is ArrivalMessage {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ArrivalMessage).title === 'string' &&
    typeof (v as ArrivalMessage).body === 'string'
  )
}

/** Gemini로 도착 안내 문구 생성. 실패 시 예외 → 호출 측에서 규칙 기반 문구 사용 */
export async function geminiMessage(config: GeminiConfig, storeName: string, benefits: Benefit[]): Promise<ArrivalMessage> {
  const parsed = await callGemini(
    config,
    [{ text: buildPrompt(storeName, prioritize(benefits)) }],
    {
      type: 'OBJECT',
      properties: { title: { type: 'STRING' }, body: { type: 'STRING' } },
      required: ['title', 'body'],
    },
    { timeoutMs: TIMEOUT_MS, temperature: 0.7 },
  )
  if (!isMessage(parsed)) throw new Error('Gemini 응답 형식이 올바르지 않습니다.')
  // 길이 규칙을 어겨도 알림에서 잘리지 않도록 안전장치
  return { title: parsed.title.trim().slice(0, 40), body: parsed.body.trim().slice(0, 140) }
}

export interface ExtractedCoupon {
  brand: string
  kind: 'coupon' | 'membership'
  title: string
  /** YYYY-MM-DD 또는 '' */
  expiresAt: string
  /** 숫자·영문만, 없으면 '' */
  barcode: string
}

function isExtracted(v: unknown): v is ExtractedCoupon {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.brand === 'string' &&
    (o.kind === 'coupon' || o.kind === 'membership') &&
    typeof o.title === 'string' &&
    typeof o.expiresAt === 'string' &&
    typeof o.barcode === 'string'
  )
}

/** YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 (2026-13-45 등 거름) */
function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !Number.isNaN(d.getTime()) && localDate(d) === s
}

/** 기프티콘·쿠폰·멤버십 캡처 이미지에서 등록 정보 추출 */
export async function geminiExtractCoupon(
  config: GeminiConfig,
  image: { mimeType: string; base64: string },
  brandNames: string[],
): Promise<ExtractedCoupon> {
  const prompt = [
    '이 이미지는 사용자가 저장한 기프티콘, 할인 쿠폰 또는 멤버십 카드 캡처다. 등록에 필요한 정보를 추출하라.',
    `오늘은 ${localDate()}이다.`,
    `- brand: 브랜드가 다음 중 하나면 정확히 그 표기로 쓴다: ${brandNames.join(', ')}. 아니면 이미지에 보이는 브랜드명.`,
    '- kind: 기프티콘·할인권·교환권이면 "coupon", 적립·회원 카드면 "membership".',
    '- title: 상품명이나 혜택 내용 (예: "아메리카노 Tall", "5,000원 할인"). 30자 이내.',
    '- expiresAt: 유효기간 마지막 날을 YYYY-MM-DD로. 없거나 안 보이면 빈 문자열.',
    '- barcode: 바코드 아래 숫자(공백·하이픈 제외). 없으면 빈 문자열.',
    '- 이미지에 없는 정보를 추측해서 채우지 않는다.',
  ].join('\n')
  const parsed = await callGemini(
    config,
    [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: prompt }],
    {
      type: 'OBJECT',
      properties: {
        brand: { type: 'STRING' },
        kind: { type: 'STRING', enum: ['coupon', 'membership'] },
        title: { type: 'STRING' },
        expiresAt: { type: 'STRING' },
        barcode: { type: 'STRING' },
      },
      required: ['brand', 'kind', 'title', 'expiresAt', 'barcode'],
    },
    { timeoutMs: 20_000, temperature: 0 },
  )
  if (!isExtracted(parsed)) throw new Error('이미지에서 정보를 읽지 못했습니다.')
  return {
    brand: parsed.brand.trim().slice(0, 20),
    kind: parsed.kind,
    title: parsed.title.trim().slice(0, 40),
    expiresAt: isRealDate(parsed.expiresAt) ? parsed.expiresAt : '',
    barcode: parsed.barcode.replace(/[^0-9A-Za-z]/g, '').slice(0, 40),
  }
}
