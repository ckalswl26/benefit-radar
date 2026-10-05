import { distanceM } from './geo'
import { benefitsForStore } from './match'
import type { Benefit, LatLng, Store } from './types'

/** 이 반경 안에 들어오면 "매장 도착"으로 판단 (m) */
export const GEOFENCE_M = 60
/** 주변 매장 검색·표시 반경 (m) */
export const SEARCH_RADIUS_M = 600

export interface NearbyStore {
  store: Store
  benefits: Benefit[]
  distance: number
}

/** 내 혜택과 매칭되는 매장만, 가까운 순 */
export function matchNearby(stores: Store[], benefits: Benefit[], position: LatLng | null): NearbyStore[] {
  if (!position) return []
  return stores
    .map((store) => ({
      store,
      benefits: benefitsForStore(store.matchText, benefits),
      distance: distanceM(position, store),
    }))
    .filter((n) => n.benefits.length > 0 && n.distance <= SEARCH_RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
}
