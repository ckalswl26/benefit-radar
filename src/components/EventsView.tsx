import { useEffect, useRef, useState } from 'react'
import { fetchAiEvents, FEED_TTL_MS, isEventFeed, sampleEvents, type EventFeed, type EventType } from '../events'
import type { GeminiConfig } from '../gemini'
import { loadJson, saveJson } from '../storage'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'
import { RefreshIcon, SparkleIcon } from './icons'

interface Props {
  gemini: GeminiConfig
  /** 검색 대상: 내 지갑 브랜드 + 인기 브랜드 */
  brands: string[]
  walletBrands: string[]
  nearbyBrands: string[]
}

type Filter = 'all' | 'wallet' | 'nearby'

const FEED_KEY = 'br.events'
const TYPE_EMOJI: Record<EventType, string> = { '1+1': '🎁', 할인: '💸', 적립: '⭐', 증정: '🎀', 기타: '📣' }

function timeAgo(at: number): string {
  const m = Math.round((Date.now() - at) / 60_000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  return `${Math.round(m / 60)}시간 전`
}

export function EventsView({ gemini, brands, walletBrands, nearbyBrands }: Props) {
  const key = brands.join('|')
  const [feed, setFeed] = useState<EventFeed | null>(() => loadJson<EventFeed | null>(FEED_KEY, null, isEventFeed))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const reqId = useRef(0)

  async function load() {
    const id = ++reqId.current
    if (!gemini.apiKey) {
      const s = sampleEvents(brands)
      setFeed(s)
      saveJson(FEED_KEY, s)
      return
    }
    setLoading(true)
    setError('')
    try {
      const f = await fetchAiEvents(gemini, brands)
      // 탭을 떠났어도 결과는 저장 (검색 할당량 절약), 화면 반영은 최신 요청만
      saveJson(FEED_KEY, f)
      if (id !== reqId.current) return
      setFeed(f)
    } catch (e) {
      if (id !== reqId.current) return
      setError(e instanceof Error ? e.message : String(e))
      setFeed((cur) => cur ?? sampleEvents(brands))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }

  // 처음 열 때·브랜드나 키가 바뀔 때, 캐시가 없거나 오래됐으면 자동 수집 (API 호출 절약)
  useEffect(() => {
    const stale =
      !feed || feed.key !== key || Date.now() - feed.fetchedAt > FEED_TTL_MS || (feed.origin === 'sample' && !!gemini.apiKey)
    if (stale) void load()
    return () => {
      // 언마운트·조건 변경 시 늦은 응답 무시 (DOM ref가 아닌 요청 카운터라 cleanup에서 최신값 증가가 의도)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      reqId.current++
    }
    // feed는 의도적으로 제외 (수집 결과로 다시 실행되지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gemini.apiKey, gemini.model])

  const events = (feed?.events ?? []).filter((e) =>
    filter === 'wallet' ? walletBrands.includes(e.brand) : filter === 'nearby' ? nearbyBrands.includes(e.brand) : true,
  )

  return (
    <section className="view">
      <header className="page-head">
        <div>
          <h1 className="page-title">할인·이벤트</h1>
          <p className="page-sub">흩어진 행사를 AI가 한눈에 모았어요</p>
        </div>
        <button
          className="round-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-label="새로 모으기"
        >
          <RefreshIcon width={18} height={18} className={loading ? 'spin' : ''} />
        </button>
      </header>

      <div className={`feed-status ${feed?.origin === 'sample' ? 'sample' : ''}`}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" /> Gemini가 최신 행사를 검색하는 중…
          </>
        ) : feed?.origin === 'ai' ? (
          <>
            <SparkleIcon width={15} height={15} /> AI가 {feed.events.length}개 행사를 모았어요 · {timeAgo(feed.fetchedAt)}
          </>
        ) : (
          <>📝 예시 데이터예요 · {gemini.apiKey ? '검색에 실패해 예시를 보여드려요' : '설정에서 Gemini 키를 넣으면 실제 행사를 모아요'}</>
        )}
      </div>
      {error && !loading && <p className="hint err-text">{error}</p>}

      <div className="chips" role="group" aria-label="필터">
        {(
          [
            ['all', '전체'],
            ['wallet', '내 지갑 브랜드'],
            ['nearby', '근처 매장'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {events.length === 0 && !loading && (
        <div className="empty-card">
          <Mascot size={110} float />
          <p>{filter === 'all' ? '모은 행사가 없어요.' : '조건에 맞는 행사가 없어요.'}</p>
        </div>
      )}

      <div className="list">
        {events.map((e) => (
          <article key={e.id} className="event-card">
            <BrandAvatar brand={e.brand} size={44} />
            <div className="event-main">
              <div className="event-top">
                <span className="event-brand">{e.brand}</span>
                <span className={`pill type t-${e.type === '1+1' ? 'bogo' : e.type}`}>
                  {TYPE_EMOJI[e.type]} {e.type}
                </span>
                {walletBrands.includes(e.brand) && <span className="pill coupon">내 지갑</span>}
                {nearbyBrands.includes(e.brand) && <span className="pill here">근처</span>}
              </div>
              <div className="event-title">{e.title}</div>
              {e.summary && <div className="event-summary">{e.summary}</div>}
              <div className="event-meta">
                {e.period && <span>🗓 {e.period.replaceAll('-', '.').replace('~', ' ~ ')}</span>}
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    출처 보기 ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {feed?.origin === 'ai' && feed.sources.length > 0 && (
        <>
          <h2 className="section-title">검색 출처</h2>
          <div className="group">
            {feed.sources.map((s) => (
              <a key={s.uri} className="group-row" href={s.uri} target="_blank" rel="noopener noreferrer">
                <span className="row-text">
                  <small>{s.title || s.uri}</small>
                </span>
                <span className="chev" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </>
      )}
      {feed?.origin === 'ai' && feed.searchEntryHtml && (
        // Google 검색 제안: 이용 조건에 따라 Google이 준 HTML을 그대로 표시 (앱 스타일과 격리)
        <iframe
          className="search-entry"
          title="Google 검색 제안"
          srcDoc={`<base target="_blank">${feed.searchEntryHtml}`}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      )}
      <p className="hint">AI가 검색 결과를 요약한 정보라 실제와 다를 수 있어요. 사용 전 출처에서 확인하세요.</p>
    </section>
  )
}
