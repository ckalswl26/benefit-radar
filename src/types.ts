export type BenefitKind = 'membership' | 'coupon'

export interface Benefit {
  id: string
  kind: BenefitKind
  brand: string
  /** 매장명 매칭용 키워드 (소문자 비교) */
  keywords: string[]
  title: string
  /** 바코드 번호 등 */
  memo?: string
  /** YYYY-MM-DD */
  expiresAt?: string
  createdAt: number
  /** 쿠폰 사용 완료 시각 (멤버십은 반복 사용이라 없음) */
  usedAt?: number
}

export interface Store {
  id: string
  name: string
  /** 매칭용 문자열: name + OSM brand/name:ko/name:en 태그 */
  matchText: string
  lat: number
  lng: number
  source: 'osm' | 'custom'
}

export interface LatLng {
  lat: number
  lng: number
}
