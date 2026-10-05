export interface BrandPreset {
  brand: string
  keywords: string[]
  color: string
}

export const BRAND_PRESETS: BrandPreset[] = [
  { brand: '스타벅스', keywords: ['스타벅스', 'starbucks'], color: '#00704a' },
  { brand: '투썸플레이스', keywords: ['투썸', 'twosome'], color: '#c8102e' },
  { brand: '이디야', keywords: ['이디야', 'ediya'], color: '#1c3b8c' },
  { brand: '메가커피', keywords: ['메가커피', '메가mgc', 'mega coffee', 'megacoffee'], color: '#f5c400' },
  { brand: 'CU', keywords: ['cu', '씨유'], color: '#652f8d' },
  { brand: 'GS25', keywords: ['gs25', '지에스25'], color: '#0071bc' },
  { brand: '세븐일레븐', keywords: ['세븐일레븐', '7-eleven', '7eleven', '7-11'], color: '#ee7203' },
  { brand: '이마트24', keywords: ['이마트24', 'emart24'], color: '#ffb81c' },
  { brand: '올리브영', keywords: ['올리브영', 'olive young', 'oliveyoung'], color: '#9bcb3c' },
  { brand: '다이소', keywords: ['다이소', 'daiso'], color: '#e60012' },
  { brand: '파리바게뜨', keywords: ['파리바게뜨', 'paris baguette'], color: '#004a98' },
  { brand: '뚜레쥬르', keywords: ['뚜레쥬르', 'tous les jours'], color: '#00563f' },
  { brand: '맥도날드', keywords: ['맥도날드', "mcdonald's", 'mcdonalds'], color: '#da291c' },
  { brand: '버거킹', keywords: ['버거킹', 'burger king'], color: '#d62300' },
  { brand: '배스킨라빈스', keywords: ['배스킨라빈스', 'baskin robbins', 'baskin-robbins'], color: '#da1884' },
  { brand: 'CGV', keywords: ['cgv'], color: '#e71a0f' },
  { brand: '메가박스', keywords: ['메가박스', 'megabox'], color: '#351f66' },
  { brand: '롯데시네마', keywords: ['롯데시네마', 'lotte cinema'], color: '#ed1c24' },
]

const FALLBACK_COLOR = '#4b5563'

export function brandColor(brand: string): string {
  return BRAND_PRESETS.find((p) => p.brand === brand)?.color ?? FALLBACK_COLOR
}

/** 색을 amount(−1~1)만큼 어둡게/밝게 */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** 아바타에 들어갈 짧은 글자: 영문 브랜드는 앞 4자까지, 한글은 첫 글자 */
export function brandMark(brand: string): string {
  const t = brand.trim()
  if (/^[A-Za-z0-9]/.test(t)) return t.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
  return t.slice(0, 1)
}

/** 배경색 위에서 읽히는 글자색 (밝은 노랑·연두 브랜드는 어두운 글자) */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  // 흰 글자·검은 글자 대비가 같아지는 지점(L≈0.18) 기준
  return L > 0.18 ? '#1b1d2a' : '#ffffff'
}
