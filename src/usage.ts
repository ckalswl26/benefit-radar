import type { Benefit, BenefitKind } from './types'

/** 혜택 사용 기록 (쿠폰은 1회, 멤버십은 여러 번) */
export interface UsageLog {
  id: string
  benefitId: string
  brand: string
  title: string
  kind: BenefitKind
  /** 아낀 금액(원) */
  amount: number
  at: number
}

export function isUsageList(v: unknown): v is UsageLog[] {
  return (
    Array.isArray(v) &&
    v.every(
      (u: Partial<UsageLog> | null) =>
        typeof u === 'object' &&
        u !== null &&
        typeof u.id === 'string' &&
        typeof u.brand === 'string' &&
        typeof u.title === 'string' &&
        typeof u.amount === 'number' &&
        typeof u.at === 'number',
    )
  )
}

/**
 * 제목에서 아낀 금액 추정. 여러 금액이면 "할인·적립·무료" 바로 앞 금액, 없으면 마지막 금액.
 * 예: "3만원 이상 구매 시 5,000원 할인" → 5000, "1만원 할인" → 10000, "2천원 할인" → 2000
 */
export function guessAmount(title: string): number | null {
  const found = [...title.matchAll(/([\d,.]+)\s*(만|천)?\s*원/g)].map((m) => ({
    n: Number(m[1].replaceAll(',', '')) * (m[2] === '만' ? 10_000 : m[2] === '천' ? 1_000 : 1),
    rest: title.slice((m.index ?? 0) + m[0].length),
  }))
  const valid = found.filter((f) => Number.isFinite(f.n) && f.n > 0)
  if (valid.length === 0) return null
  const pick = valid.find((f) => /^\s*(할인|적립|무료|off)/i.test(f.rest)) ?? valid[valid.length - 1]
  return Math.round(pick.n)
}

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export function isThisMonth(at: number, now = new Date()): boolean {
  const d = new Date(at)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/** 브랜드별 합계, 큰 순 */
export function totalsByBrand(logs: UsageLog[]): { brand: string; amount: number; count: number }[] {
  const map = new Map<string, { amount: number; count: number }>()
  for (const l of logs) {
    const cur = map.get(l.brand) ?? { amount: 0, count: 0 }
    map.set(l.brand, { amount: cur.amount + l.amount, count: cur.count + 1 })
  }
  return [...map.entries()].map(([brand, v]) => ({ brand, ...v })).sort((a, b) => b.amount - a.amount)
}

export function makeLog(b: Benefit, amount: number): UsageLog {
  return { id: crypto.randomUUID(), benefitId: b.id, brand: b.brand, title: b.title, kind: b.kind, amount, at: Date.now() }
}

/** 시연용: 이번 달 사용 기록 몇 건 (오늘 기준 며칠 전, 이번 달을 넘지 않게) */
export function sampleUsage(): UsageLog[] {
  const now = new Date()
  const daysAgo = (d: number, h: number) => {
    const t = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - d), h)
    // 월초에는 날짜가 1일로 몰려 미래 시각이 될 수 있으므로 현재로 제한
    return Math.min(t.getTime(), now.getTime())
  }
  const base = { benefitId: 'sample-history' }
  return [
    { ...base, id: 'u1', brand: 'CU', title: 'CU 멤버십 적립', kind: 'membership', amount: 320, at: daysAgo(0, 9) },
    { ...base, id: 'u2', brand: '메가커피', title: '아이스 아메리카노 쿠폰', kind: 'coupon', amount: 2000, at: daysAgo(1, 13) },
    { ...base, id: 'u3', brand: '올리브영', title: '20% 할인 쿠폰', kind: 'coupon', amount: 6800, at: daysAgo(2, 19) },
    { ...base, id: 'u4', brand: 'CU', title: 'CU 멤버십 적립', kind: 'membership', amount: 150, at: daysAgo(3, 8) },
    { ...base, id: 'u5', brand: '스타벅스', title: '생일 음료 쿠폰', kind: 'coupon', amount: 6100, at: daysAgo(4, 15) },
  ]
}
