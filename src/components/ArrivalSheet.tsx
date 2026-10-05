import { useEffect } from 'react'
import { brandColor } from '../brands'
import type { ArrivalMessage } from '../message'
import { prioritize } from '../message'
import type { NearbyStore } from '../nearby'
import type { Benefit } from '../types'
import { BenefitCard } from './BenefitCard'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'
import { SparkleIcon } from './icons'

export interface Arrival {
  id: string
  nearby: NearbyStore
  message: ArrivalMessage
  ai: 'off' | 'loading' | 'done' | 'failed'
}

interface Props {
  arrival: Arrival
  onClose: () => void
  onOpen: (benefit: Benefit) => void
}

export function ArrivalSheet({ arrival, onClose, onOpen }: Props) {
  const { nearby, message } = arrival
  const brand = nearby.benefits[0].brand

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet arrival"
        role="dialog"
        aria-modal="true"
        aria-label={message.title}
        onClick={(e) => e.stopPropagation()}
        style={{ '--brand': brandColor(brand) } as React.CSSProperties}
      >
        <div className="sheet-grip" />
        <div className="arrival-hero">
          <span className="arrival-wave" aria-hidden="true" />
          <span className="arrival-wave delay" aria-hidden="true" />
          <Mascot size={104} className="arrival-mascot" />
          <span className="arrival-badge">
            <BrandAvatar brand={brand} size={40} />
          </span>
          <span className="arrival-confetti" aria-hidden="true">
            🎉
          </span>
        </div>
        <div className="arrival-store">{nearby.store.name} 도착</div>
        <h2 className="sheet-title">{message.title}</h2>
        {arrival.ai === 'loading' && (
          <div className="ai-badge loading">
            <SparkleIcon width={14} height={14} /> AI가 추천을 고르는 중…
          </div>
        )}
        {arrival.ai === 'done' && (
          <div className="ai-badge">
            <SparkleIcon width={14} height={14} /> Gemini 추천
          </div>
        )}
        <p className="sheet-body">{message.body}</p>
        <div className="list">
          {prioritize(nearby.benefits).map((b) => (
            <BenefitCard key={b.id} benefit={b} onOpen={onOpen} />
          ))}
        </div>
        <button className="btn primary sheet-btn" onClick={onClose} autoFocus>
          확인했어요 👍
        </button>
      </div>
    </div>
  )
}
