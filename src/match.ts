import type { Benefit } from './types'

const SHORT_ASCII = /^[a-z0-9-]{1,3}$/

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 매장명에 키워드가 포함되는지 검사.
 * 3자 이하 영문/숫자 키워드(cu, cgv 등)는 앞뒤가 영문·숫자가 아닐 때만 일치
 * → "Cucina", "Focus" 같은 오탐 방지. 그 외는 부분 일치.
 */
export function nameMatchesKeyword(storeName: string, keyword: string): boolean {
  const name = storeName.toLowerCase()
  const kw = keyword.toLowerCase()
  if (SHORT_ASCII.test(kw)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(kw)}($|[^a-z0-9])`).test(name)
  }
  return name.includes(kw)
}

export function benefitsForStore(storeName: string, benefits: Benefit[]): Benefit[] {
  return benefits.filter((b) => b.keywords.some((kw) => nameMatchesKeyword(storeName, kw)))
}
