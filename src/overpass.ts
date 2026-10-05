import type { LatLng, Store } from './types'

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const REQUEST_TIMEOUT_MS = 12_000
const QUERY_TAGS = ['name', 'brand']
const MATCH_TAGS = ['name', 'brand', 'brand:ko', 'name:ko', 'name:en']

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function escapeEre(s: string): string {
  return s.replace(/[.[\]()*+?{}|^$\\"]/g, '\\$&')
}

function buildQuery(center: LatLng, radiusM: number, keywords: string[]): string {
  const re = keywords.map(escapeEre).join('|')
  const around = `around:${radiusM},${center.lat},${center.lng}`
  const parts = QUERY_TAGS.map((tag) => `nwr(${around})["${tag}"~"${re}",i];`).join('')
  return `[out:json][timeout:20];(${parts});out center tags;`
}

function toStore(el: OverpassElement): Store | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const tags = el.tags ?? {}
  const name = tags['name:ko'] ?? tags.name ?? tags.brand
  if (lat === undefined || lng === undefined || !name) return null
  const matchText = MATCH_TAGS.map((t) => tags[t])
    .filter(Boolean)
    .join(' ')
  return { id: `osm-${el.type}-${el.id}`, name, matchText, lat, lng, source: 'osm' }
}

/** 반경 내에서 키워드가 이름/브랜드에 포함된 매장 검색 (OpenStreetMap Overpass) */
export async function fetchStores(
  center: LatLng,
  radiusM: number,
  keywords: string[],
  signal: AbortSignal,
): Promise<Store[]> {
  if (keywords.length === 0) return []
  const body = new URLSearchParams({ data: buildQuery(center, radiusM, keywords) })
  let lastError: unknown
  for (const url of ENDPOINTS) {
    if (signal.aborted) throw signal.reason
    // 서버가 대기열에 걸려 응답이 없을 때 다음 엔드포인트로 넘어가도록 개별 타임아웃
    // (AbortSignal.any는 구형 브라우저 미지원이라 직접 연결)
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal.addEventListener('abort', onAbort)
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, { method: 'POST', body, signal: ctrl.signal })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = (await res.json()) as { elements: OverpassElement[] }
      return json.elements.map(toStore).filter((s): s is Store => s !== null)
    } catch (e) {
      if (signal.aborted) throw e
      lastError = e
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  }
  throw lastError
}
