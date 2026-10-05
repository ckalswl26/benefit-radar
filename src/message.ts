import { daysUntil, isActive } from './storage'
import type { Benefit } from './types'

export interface ArrivalMessage {
  title: string
  body: string
}

/** 만료 임박 쿠폰 → 다른 쿠폰 → 멤버십 순으로 정렬 */
export function prioritize(benefits: Benefit[]): Benefit[] {
  const rank = (b: Benefit) =>
    b.kind === 'coupon' ? (b.expiresAt ? daysUntil(b.expiresAt) : 10_000) : 100_000
  return benefits.filter(isActive).sort((a, b) => rank(a) - rank(b))
}

/** AI를 쓰지 못할 때의 규칙 기반 안내 문구 */
export function ruleMessage(storeName: string, benefits: Benefit[]): ArrivalMessage {
  const list = prioritize(benefits)
  const top = list[0]
  const title = `${storeName} 도착! 쓸 수 있는 혜택 ${list.length}개`

  const parts: string[] = []
  if (top.kind === 'coupon') {
    const d = top.expiresAt ? daysUntil(top.expiresAt) : null
    const when = d === null ? '' : d === 0 ? ' (오늘 만료!)' : d <= 3 ? ` (${d}일 뒤 만료)` : ''
    parts.push(`'${top.title}' 쿠폰이 있어요${when}.`)
  } else {
    parts.push(`${top.title} 적립을 잊지 마세요.`)
  }
  const membership = list.find((b) => b.kind === 'membership' && b.id !== top.id)
  if (membership) parts.push(`${membership.brand} 멤버십도 함께 쓰세요.`)
  parts.push('결제 전에 꺼내 보세요.')

  return { title, body: parts.join(' ') }
}
