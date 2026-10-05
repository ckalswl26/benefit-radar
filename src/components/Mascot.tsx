interface Props {
  size?: number
  /** 둥실둥실 떠 있는 애니메이션 */
  float?: boolean
  className?: string
  /** 의미 있는 이미지로 읽혀야 할 때만 (기본은 장식) */
  alt?: string
}

const base = import.meta.env.BASE_URL

/** 서비스 마스코트 "지갑이" */
export function Mascot({ size = 96, float = false, className = '', alt = '' }: Props) {
  return (
    <img
      src={`${base}mascot-sm.webp`}
      srcSet={`${base}mascot-sm.webp 240w, ${base}mascot.webp 720w`}
      sizes={`${size}px`}
      decoding="async"
      width={size}
      height={Math.round(size * 0.937)}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={`mascot ${float ? 'float' : ''} ${className}`}
      draggable={false}
    />
  )
}
