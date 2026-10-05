import type { Benefit, Store } from './types'

export function loadJson<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 불가(시크릿 모드 등) — 메모리 상태만 유지
  }
}

/** 로컬 시간대 기준 YYYY-MM-DD */
export function localDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDate(d)
}

export function isBenefitList(v: unknown): v is Benefit[] {
  return (
    Array.isArray(v) &&
    v.every(
      (b: Partial<Benefit> | null) =>
        typeof b === 'object' &&
        b !== null &&
        typeof b.id === 'string' &&
        typeof b.brand === 'string' &&
        typeof b.title === 'string' &&
        Array.isArray(b.keywords) &&
        (b.kind === 'coupon' || b.kind === 'membership'),
    )
  )
}

export function isStoreList(v: unknown): v is Store[] {
  return (
    Array.isArray(v) &&
    v.every(
      (s: Partial<Store> | null) =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        typeof s.matchText === 'string' &&
        typeof s.lat === 'number' &&
        typeof s.lng === 'number',
    )
  )
}

/** 첫 실행 시 시연용 샘플 */
export function sampleBenefits(): Benefit[] {
  const now = Date.now()
  return [
    {
      id: 'sample-1',
      kind: 'coupon',
      brand: '스타벅스',
      keywords: ['스타벅스', 'starbucks'],
      title: '아메리카노 Tall 1잔 무료',
      memo: '9310 2834 5512 0087',
      expiresAt: daysFromToday(3),
      createdAt: now,
    },
    {
      id: 'sample-2',
      kind: 'membership',
      brand: 'CU',
      keywords: ['cu', '씨유'],
      title: 'CU 멤버십 (1,000원당 10P 적립)',
      memo: '1234-5678-9012',
      createdAt: now,
    },
    {
      id: 'sample-3',
      kind: 'coupon',
      brand: '올리브영',
      keywords: ['올리브영', 'olive young', 'oliveyoung'],
      title: '3만원 이상 구매 시 5,000원 할인',
      memo: '8801 0457 2290',
      expiresAt: daysFromToday(10),
      createdAt: now,
    },
  ]
}

export function daysUntil(dateStr: string): number {
  const today = new Date(localDate() + 'T00:00:00')
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** 매칭·알림 대상: 사용 완료하지 않았고 만료되지 않은 혜택 */
export function isActive(b: Benefit): boolean {
  return !b.usedAt && (!b.expiresAt || daysUntil(b.expiresAt) >= 0)
}

export function expiryLabel(expiresAt?: string): { text: string; urgent: boolean } | null {
  if (!expiresAt) return null
  const d = daysUntil(expiresAt)
  if (d < 0) return { text: '만료됨', urgent: true }
  if (d === 0) return { text: '오늘 만료', urgent: true }
  return { text: `D-${d}`, urgent: d <= 3 }
}
