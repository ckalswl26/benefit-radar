import type { LatLng } from './types'

const EARTH_R = 6_371_000

/** 두 좌표 사이 거리(m), haversine */
export function distanceM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(h))
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

/** 시뮬레이션 기본 위치: 강남역 */
export const DEFAULT_POSITION: LatLng = { lat: 37.49795, lng: 127.02762 }
