import { brandColor, brandMark, inkOn } from '../brands'

interface Props {
  brand: string
  size?: number
}

export function BrandAvatar({ brand, size = 44 }: Props) {
  const color = brandColor(brand)
  const mark = brandMark(brand)
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        color: inkOn(color),
        fontSize: size * ([0.46, 0.46, 0.36, 0.3, 0.26][mark.length] ?? 0.26),
      }}
      aria-hidden="true"
    >
      {mark}
    </span>
  )
}
