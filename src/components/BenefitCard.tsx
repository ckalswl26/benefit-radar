import type { CSSProperties } from 'react'
import { brandColor, inkOn, shade } from '../brands'
import { expiryLabel } from '../storage'
import type { Benefit } from '../types'
import { BrandAvatar } from './BrandAvatar'
import { TrashIcon } from './icons'

interface Props {
  benefit: Benefit
  onDelete?: (id: string) => void
  /** 카드를 누르면 바코드 보기 */
  onOpen?: (benefit: Benefit) => void
}

function DeleteButton({ benefit, onDelete, light }: { benefit: Benefit; onDelete: (id: string) => void; light?: boolean }) {
  return (
    <button
      className={`card-del ${light ? 'light' : ''}`}
      aria-label={`${benefit.brand} 혜택 삭제`}
      onClick={() => confirm(`${benefit.brand} 혜택을 삭제할까요?`) && onDelete(benefit.id)}
    >
      <TrashIcon width={18} height={18} />
    </button>
  )
}

/** 카드 전체를 덮는 투명 버튼 (삭제 버튼과 중첩되지 않도록 형제로 배치) */
function OpenButton({ benefit, onOpen }: { benefit: Benefit; onOpen: (b: Benefit) => void }) {
  return <button className="card-open" aria-label={`${benefit.brand} ${benefit.title} 바코드 보기`} onClick={() => onOpen(benefit)} />
}

export function BenefitCard({ benefit, onDelete, onOpen }: Props) {
  const color = brandColor(benefit.brand)
  const ink = inkOn(color)
  const expiry = expiryLabel(benefit.expiresAt)

  if (benefit.kind === 'membership') {
    const style = {
      background: `linear-gradient(135deg, ${shade(color, 0.12)} 0%, ${shade(color, -0.28)} 100%)`,
      color: ink,
    } as CSSProperties
    return (
      <article className="mcard" style={style}>
        <div className="mcard-top">
          <span className="mcard-brand">{benefit.brand}</span>
          <span className="mcard-kind">MEMBERSHIP</span>
        </div>
        <div className="mcard-chip" aria-hidden="true" />
        <div className="mcard-title">{benefit.title}</div>
        {benefit.memo && (
          <div className="mcard-barcode">
            <span className="bars" aria-hidden="true" />
            <span className="num">{benefit.memo}</span>
          </div>
        )}
        {onOpen && <OpenButton benefit={benefit} onOpen={onOpen} />}
        {onDelete && <DeleteButton benefit={benefit} onDelete={onDelete} light={ink === '#ffffff'} />}
      </article>
    )
  }

  return (
    <div className="ticket-wrap">
      <article className={`ticket ${expiry?.urgent ? 'urgent' : ''}`}>
        <div className="ticket-stub" style={{ background: color, color: ink }}>
          <BrandAvatar brand={benefit.brand} size={40} />
          <span className="ticket-dday">{expiry?.text ?? '상시'}</span>
        </div>
        <div className="ticket-body">
          <div className="ticket-brand">
            {benefit.brand} <span className="pill coupon">쿠폰</span>
          </div>
          <div className="ticket-title">{benefit.title}</div>
          {benefit.expiresAt && <div className="ticket-sub">{benefit.expiresAt.replaceAll('-', '.')} 까지</div>}
          {benefit.memo && <div className="ticket-sub mono">{benefit.memo}</div>}
        </div>
        {onOpen && <OpenButton benefit={benefit} onOpen={onOpen} />}
        {onDelete && <DeleteButton benefit={benefit} onDelete={onDelete} />}
      </article>
    </div>
  )
}
