import { useState } from 'react'
import { daysUntil } from '../storage'
import type { Benefit } from '../types'
import { formatWon, isThisMonth, totalsByBrand, type UsageLog } from '../usage'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'

interface Props {
  benefits: Benefit[]
  usage: UsageLog[]
}

function formatWhen(at: number): string {
  const d = new Date(at)
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ReportView({ benefits, usage }: Props) {
  const [now] = useState(() => new Date())
  const month = usage.filter((u) => isThisMonth(u.at, now))
  const total = month.reduce((s, u) => s + u.amount, 0)
  const brands = totalsByBrand(month)
  const max = Math.max(1, ...brands.map((b) => b.amount))
  // 놓친 혜택: 쓰지 않고 만료된 쿠폰
  const missed = benefits.filter((b) => b.kind === 'coupon' && !b.usedAt && b.expiresAt && daysUntil(b.expiresAt) < 0)
  const recent = [...usage].sort((a, b) => b.at - a.at).slice(0, 10)
  const monthLabel = `${now.getMonth() + 1}월`

  return (
    <section className="view">
      <header className="page-head">
        <div>
          <h1 className="page-title">절약 리포트</h1>
          <p className="page-sub">혜택을 챙긴 만큼 쌓여요 💰</p>
        </div>
      </header>

      <div className="hero-card">
        <div className="hero-label">{monthLabel}에 아낀 금액</div>
        <div className="hero-num">{formatWon(total)}</div>
        <div className="hero-sub">
          혜택 {month.length}번 사용 · 커피 약 {Math.floor(total / 4500)}잔 ☕
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-num">{month.filter((u) => u.kind === 'coupon').length}</span>
          <span className="stat-label">쓴 쿠폰</span>
        </div>
        <div className="stat">
          <span className="stat-num">{month.filter((u) => u.kind === 'membership').length}</span>
          <span className="stat-label">멤버십 적립</span>
        </div>
        <div className={`stat ${missed.length > 0 ? 'hot' : ''}`}>
          <span className="stat-num">{missed.length}</span>
          <span className="stat-label">놓친 쿠폰</span>
        </div>
      </div>

      <h2 className="section-title">브랜드별 절약</h2>
      {brands.length === 0 ? (
        <div className="empty-card">
          <Mascot size={110} float />
          <p>이번 달 사용 기록이 없어요. 쿠폰을 열고 "사용 완료"를 눌러 보세요.</p>
        </div>
      ) : (
        <div className="card bars" role="list" aria-label={`${monthLabel} 브랜드별 절약 금액`}>
          {brands.map((b) => (
            <div key={b.brand} className="bar-row" role="listitem" title={`${b.brand} ${formatWon(b.amount)} · ${b.count}회`}>
              <BrandAvatar brand={b.brand} size={30} />
              <div className="bar-main">
                <div className="bar-label">
                  <span>{b.brand}</span>
                  <span className="bar-value">{formatWon(b.amount)}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(4, (b.amount / max) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {missed.length > 0 && (
        <>
          <h2 className="section-title">놓친 혜택 😢</h2>
          <div className="group">
            {missed.map((b) => (
              <div key={b.id} className="group-row static">
                <BrandAvatar brand={b.brand} size={36} />
                <span className="row-text">
                  <b>{b.title}</b>
                  <small>
                    {b.brand} · {b.expiresAt?.replaceAll('-', '.')} 만료
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p className="hint">레이더를 켜 두면 매장 근처에서 미리 알려드려요.</p>
        </>
      )}

      <h2 className="section-title">최근 사용 기록</h2>
      {recent.length === 0 ? (
        <p className="hint">아직 기록이 없어요.</p>
      ) : (
        <div className="group">
          {recent.map((u) => (
            <div key={u.id} className="group-row static">
              <BrandAvatar brand={u.brand} size={36} />
              <span className="row-text">
                <b>{u.title}</b>
                <small>
                  {u.brand} · {formatWhen(u.at)}
                </small>
              </span>
              <span className="saved">+{formatWon(u.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
