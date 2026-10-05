import { useState } from 'react'
import { daysUntil, isActive } from '../storage'
import type { GeminiConfig } from '../gemini'
import type { Benefit } from '../types'
import { formatWon, isThisMonth, type UsageLog } from '../usage'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'
import { BenefitCard } from './BenefitCard'
import { BenefitForm, type ScanMode } from './BenefitForm'
import { PlusIcon } from './icons'

interface Props {
  benefits: Benefit[]
  onAdd: (benefit: Benefit) => void
  onDelete: (id: string) => void
  onOpen: (benefit: Benefit) => void
  gemini: GeminiConfig
  scanMode: ScanMode
  usage: UsageLog[]
  onGoReport: () => void
}

export function WalletView({ benefits, onAdd, onDelete, onOpen, gemini, scanMode, usage, onGoReport }: Props) {
  const [adding, setAdding] = useState(false)
  // 사용 완료한 쿠폰은 지갑에서 빼고 리포트 기록으로
  const coupons = benefits.filter((b) => b.kind === 'coupon' && !b.usedAt)
  const memberships = benefits.filter((b) => b.kind === 'membership')
  const soon = coupons.filter((b) => b.expiresAt && isActive(b) && daysUntil(b.expiresAt) <= 3).length
  const thisWeek = coupons
    .filter((b) => b.expiresAt && isActive(b) && daysUntil(b.expiresAt) <= 7)
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''))
  const saved = usage.filter((u) => isThisMonth(u.at)).reduce((s, u) => s + u.amount, 0)

  return (
    <section className="view">
      <header className="page-head">
        <div>
          <h1 className="page-title">내 지갑</h1>
          <p className="page-sub">잊지 않게, 놓치지 않게 🧡</p>
        </div>
        <button className="btn primary icon-btn-lg" onClick={() => setAdding(true)} aria-label="혜택 추가">
          <PlusIcon />
        </button>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat-num">{coupons.length}</span>
          <span className="stat-label">쿠폰</span>
        </div>
        <div className="stat">
          <span className="stat-num">{memberships.length}</span>
          <span className="stat-label">멤버십</span>
        </div>
        <div className={`stat ${soon > 0 ? 'hot' : ''}`}>
          <span className="stat-num">{soon}</span>
          <span className="stat-label">곧 만료</span>
        </div>
      </div>

      <div className="brief-row">
        <button className="brief saved-card" onClick={onGoReport}>
          <span className="brief-label">이번 달 아낀 금액</span>
          <span className="brief-num">{formatWon(saved)}</span>
          <span className="brief-link">리포트 보기 ›</span>
        </button>
        <div className={`brief expiry-card ${thisWeek.length > 0 ? 'hot' : ''}`}>
          <span className="brief-label">이번 주 만료</span>
          {thisWeek.length === 0 ? (
            <span className="brief-empty">여유 있어요 😌</span>
          ) : (
            <div className="brief-list">
              {thisWeek.slice(0, 3).map((b) => (
                <button key={b.id} className="brief-item" onClick={() => onOpen(b)} aria-label={`${b.brand} ${b.title} 바코드 보기`}>
                  <BrandAvatar brand={b.brand} size={22} />
                  <span>D-{daysUntil(b.expiresAt ?? '')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {benefits.length === 0 && (
        <div className="empty-card">
          <Mascot size={110} float />
          <p>아직 지갑이 비어 있어요.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>
            첫 혜택 넣기
          </button>
        </div>
      )}

      {memberships.length > 0 && (
        <>
          <h2 className="section-title">멤버십</h2>
          <div className="list">
            {memberships.map((b) => (
              <BenefitCard key={b.id} benefit={b} onDelete={onDelete} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}

      {coupons.length > 0 && (
        <>
          <h2 className="section-title">쿠폰</h2>
          <div className="list">
            {coupons.map((b) => (
              <BenefitCard key={b.id} benefit={b} onDelete={onDelete} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}

      {adding && (
        <BenefitForm
          gemini={gemini}
          scanMode={scanMode}
          onSubmit={(b) => {
            onAdd(b)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  )
}
