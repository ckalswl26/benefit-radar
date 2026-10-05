import JsBarcode from 'jsbarcode'
import { useEffect, useRef, useState } from 'react'
import { expiryLabel } from '../storage'
import type { Benefit } from '../types'
import { guessAmount } from '../usage'
import { BrandAvatar } from './BrandAvatar'

interface Props {
  benefit: Benefit
  onClose: () => void
  /** 사용 완료 처리 (아낀 금액, 원) */
  onUse: (benefit: Benefit, amount: number) => void
}

/** 계산대에서 바로 스캔할 수 있게 바코드를 크게 보여주는 시트 */
export function BarcodeSheet({ benefit, onClose, onUse }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const code = benefit.memo?.replace(/\s|-/g, '') ?? ''
  // CODE128은 출력 가능한 ASCII만 표현 가능
  const invalid = code !== '' && !/^[ -~]+$/.test(code)
  const expiry = expiryLabel(benefit.expiresAt)
  const [amount, setAmount] = useState(() => String(guessAmount(benefit.title) ?? ''))
  const amountNum = Number(amount.replace(/[^\d]/g, '')) || 0

  useEffect(() => {
    if (!code || invalid || !svgRef.current) return
    try {
      JsBarcode(svgRef.current, code, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 110,
        width: 2.4,
        background: '#ffffff',
        lineColor: '#111111',
      })
    } catch {
      // 렌더링 실패 시 빈 영역 + 번호만 표시
    }
  }, [code, invalid])

  // 바코드를 보여주는 동안 화면이 꺼지지 않도록
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let closed = false
    const request = () =>
      navigator.wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l
          if (closed) void l.release()
        })
        .catch(() => {})
    // 다른 앱에 다녀오면 잠금이 풀리므로 돌아왔을 때 다시 요청
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [])

  useEffect(() => {
    // 캡처 단계에서 처리하고 전파를 막아, 아래 깔린 도착 시트까지 닫히지 않게 함
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet barcode-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${benefit.brand} 바코드`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="barcode-head">
          <BrandAvatar brand={benefit.brand} size={48} />
          <div>
            <div className="barcode-brand">{benefit.brand}</div>
            <div className="barcode-title">{benefit.title}</div>
          </div>
          {expiry && <span className={`pill ${expiry.urgent ? 'urgent' : ''}`}>{expiry.text}</span>}
        </div>

        <div className="barcode-box">
          {code && !invalid ? (
            <>
              <svg ref={svgRef} className="barcode-svg" role="img" aria-label={`바코드 ${code}`} />
              <div className="barcode-num">{benefit.memo}</div>
            </>
          ) : (
            <div className="barcode-empty">
              <div className="empty-emoji">🧾</div>
              <p>{invalid ? '바코드로 만들 수 없는 번호예요.' : '등록된 바코드 번호가 없어요.'}</p>
              <small>쿠폰을 다시 등록할 때 바코드 번호를 넣어 주세요.</small>
            </div>
          )}
        </div>
        <p className="hint center">계산대에서 이 화면을 보여주세요 · 화면 밝기를 올리면 더 잘 찍혀요</p>

        <form
          className="use-row form"
          onSubmit={(e) => {
            e.preventDefault()
            onUse(benefit, amountNum)
          }}
        >
          <label>
            {benefit.kind === 'coupon' ? '이 쿠폰으로 아낀 금액' : '이번에 적립·할인받은 금액'}
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 4500"
            />
          </label>
          <button type="submit" className="btn soft">
            ✅ 사용 완료
          </button>
        </form>

        <button className="btn primary sheet-btn" onClick={onClose} autoFocus>
          닫기
        </button>
      </div>
    </div>
  )
}
