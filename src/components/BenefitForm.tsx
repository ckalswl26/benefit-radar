import { useEffect, useRef, useState } from 'react'
import { BRAND_PRESETS } from '../brands'
import { geminiExtractCoupon, type GeminiConfig } from '../gemini'
import { fileToJpegBase64 } from '../image'
import { nameMatchesKeyword } from '../match'
import { readCouponOnDevice, type ScanProgress } from '../ondevice'
import type { Benefit, BenefitKind } from '../types'
import { BrandAvatar } from './BrandAvatar'
import { SparkleIcon } from './icons'

export type ScanMode = 'ondevice' | 'gemini'

interface Props {
  gemini: GeminiConfig
  scanMode: ScanMode
  onSubmit: (benefit: Benefit) => void
  onCancel: () => void
}

const CUSTOM = '__custom__'

type Scan = { state: 'idle' } | { state: 'loading' | 'done'; preview: string } | { state: 'error'; preview: string; error: string }

function progressLabel(p: ScanProgress | null): string {
  if (!p || p.stage === 'barcode') return '바코드를 찾는 중…'
  if (p.stage === 'model') return `인식 모델 준비 중… ${p.pct}% (처음 한 번만)`
  return `글자를 읽는 중… ${p.pct}%`
}

/** AI가 읽은 브랜드명을 프리셋에 매칭 (표기 차이: STARBUCKS, 씨유 등) */
function matchPreset(name: string): string | undefined {
  return BRAND_PRESETS.find((p) => p.brand === name || p.keywords.some((k) => nameMatchesKeyword(name, k)))?.brand
}

export function BenefitForm({ gemini, scanMode, onSubmit, onCancel }: Props) {
  const [kind, setKind] = useState<BenefitKind>('coupon')
  const [preset, setPreset] = useState(BRAND_PRESETS[0].brand)
  const [customBrand, setCustomBrand] = useState('')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [scan, setScan] = useState<Scan>({ state: 'idle' })
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const onDevice = scanMode === 'ondevice'
  const scanAvailable = onDevice || !!gemini.apiKey
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = scan.state === 'idle' ? null : scan.preview

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function handleImage(file: File) {
    const url = URL.createObjectURL(file)
    setScan({ state: 'loading', preview: url })
    try {
      setProgress(null)
      const r = onDevice
        ? await readCouponOnDevice(file, setProgress)
        : await geminiExtractCoupon(gemini, await fileToJpegBase64(file), BRAND_PRESETS.map((p) => p.brand))
      const matched = matchPreset(r.brand)
      setKind(r.kind)
      if (matched) setPreset(matched)
      else if (r.brand) {
        setPreset(CUSTOM)
        setCustomBrand(r.brand)
      }
      if (r.title) setTitle(r.title)
      if (r.barcode) setMemo(r.barcode)
      if (r.kind === 'membership') setExpiresAt('')
      else if (r.expiresAt) setExpiresAt(r.expiresAt)
      setScan({ state: 'done', preview: url })
      // 선택된 브랜드 칩이 그리드 밖에 있으면 보이게
      requestAnimationFrame(() => document.querySelector('.brand-chip.on')?.scrollIntoView({ block: 'nearest' }))
    } catch (e) {
      setScan({ state: 'error', preview: url, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const isCustom = preset === CUSTOM
  const brand = isCustom ? customBrand.trim() : preset
  const canSubmit = brand.length >= 2 && title.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const keywords = isCustom
      ? [brand.toLowerCase()]
      : (BRAND_PRESETS.find((p) => p.brand === brand)?.keywords ?? [brand.toLowerCase()])
    onSubmit({
      id: crypto.randomUUID(),
      kind,
      brand,
      keywords,
      title: title.trim(),
      memo: memo.trim() || undefined,
      expiresAt: kind === 'coupon' && expiresAt ? expiresAt : undefined,
      createdAt: Date.now(),
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form
        className="sheet form"
        role="dialog"
        aria-modal="true"
        aria-label="혜택 추가"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="sheet-grip" />
        <h2 className="sheet-heading">새 혜택 추가</h2>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImage(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={`scan-card ${scan.state}`}
          disabled={!scanAvailable || scan.state === 'loading'}
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            <img className="scan-thumb" src={preview} alt="" />
          ) : (
            <span className="scan-icon" aria-hidden="true">
              📷
            </span>
          )}
          <span className="scan-text">
            <b>
              {scan.state === 'loading'
                ? onDevice
                  ? progressLabel(progress)
                  : 'AI가 쿠폰을 읽는 중…'
                : scan.state === 'done'
                  ? onDevice
                    ? '폰 안에서 읽었어요! 확인 후 저장하세요'
                    : 'AI가 채웠어요! 확인 후 저장하세요'
                  : scan.state === 'error'
                    ? '읽지 못했어요 · 다시 시도'
                    : '캡처로 자동 채우기'}
            </b>
            <small>
              {!scanAvailable
                ? '설정에서 Gemini 키를 넣거나 온디바이스 모드를 켜 주세요'
                : scan.state === 'error'
                  ? scan.error
                  : scan.state === 'done'
                    ? '브랜드·내용·만료일이 맞는지 확인해 주세요'
                    : onDevice
                      ? '🔒 온디바이스 인식 · 이미지가 폰 밖으로 나가지 않아요'
                      : '캡처(바코드 포함)를 Gemini가 읽어요 · 이미지는 Google로 전송돼요'}
            </small>
          </span>
          {scan.state === 'loading' ? <span className="spinner" aria-hidden="true" /> : <SparkleIcon width={18} height={18} />}
        </button>

        <div className="segmented">
          <button type="button" className={kind === 'coupon' ? 'on' : ''} aria-pressed={kind === 'coupon'} onClick={() => setKind('coupon')}>
            🎟️ 쿠폰
          </button>
          <button
            type="button"
            className={kind === 'membership' ? 'on' : ''}
            aria-pressed={kind === 'membership'}
            onClick={() => setKind('membership')}
          >
            💳 멤버십
          </button>
        </div>

        <div className="field-label">브랜드</div>
        <div className="brand-grid" role="group" aria-label="브랜드">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.brand}
              type="button"
              aria-pressed={preset === p.brand}
              className={`brand-chip ${preset === p.brand ? 'on' : ''}`}
              onClick={() => setPreset(p.brand)}
            >
              <BrandAvatar brand={p.brand} size={40} />
              <span>{p.brand}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={isCustom}
            className={`brand-chip ${isCustom ? 'on' : ''}`}
            onClick={() => setPreset(CUSTOM)}
          >
            <span className="avatar etc" style={{ width: 40, height: 40 }} aria-hidden="true">
              +
            </span>
            <span>직접 입력</span>
          </button>
        </div>

        {isCustom && (
          <label>
            브랜드 이름 (매장명에 들어가는 단어)
            <input value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="예: 동네빵집" />
          </label>
        )}

        <label>
          {kind === 'coupon' ? '쿠폰 내용' : '멤버십 이름'}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'coupon' ? '예: 아메리카노 1잔 무료' : '예: 골드 등급 10% 할인'}
          />
        </label>

        <div className="field-row">
          <label>
            바코드 번호 (선택)
            <input value={memo} onChange={(e) => setMemo(e.target.value)} inputMode="numeric" />
          </label>
          {kind === 'coupon' && (
            <label>
              만료일 (선택)
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
          )}
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn primary grow" disabled={!canSubmit}>
            지갑에 넣기
          </button>
        </div>
      </form>
    </div>
  )
}
