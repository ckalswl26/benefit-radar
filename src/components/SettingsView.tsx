import { useState } from 'react'
import { resetNotified } from '../arrival'
import { DEFAULT_GEMINI_MODEL, geminiMessage, type GeminiConfig } from '../gemini'
import { sampleBenefits } from '../storage'
import type { ScanMode } from './BenefitForm'
import { BellIcon, InfoIcon, RefreshIcon, SparkleIcon } from './icons'

interface Props {
  config: GeminiConfig
  onConfigChange: (c: GeminiConfig) => void
  scanMode: ScanMode
  onScanModeChange: (m: ScanMode) => void
  onShowLanding: () => void
  onResetSamples: () => void
}

export function SettingsView({ config, onConfigChange, scanMode, onScanModeChange, onShowLanding, onResetSamples }: Props) {
  const [test, setTest] = useState<{ state: 'idle' | 'loading' | 'ok' | 'error'; text: string }>({ state: 'idle', text: '' })
  const [notice, setNotice] = useState('')

  async function runTest() {
    setTest({ state: 'loading', text: '' })
    try {
      const sample = sampleBenefits().filter((b) => b.brand === '스타벅스')
      const m = await geminiMessage(config, '스타벅스 강남역점', sample)
      setTest({ state: 'ok', text: `${m.title}\n${m.body}` })
    } catch (e) {
      setTest({ state: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  function flash(text: string) {
    setNotice(text)
    setTimeout(() => setNotice(''), 2000)
  }

  return (
    <section className="view">
      <header className="page-head">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-sub">AI 추천과 시연 도구를 관리해요</p>
        </div>
      </header>

      <div className="card ai-card form">
        <div className="ai-card-head">
          <span className="ai-icon">
            <SparkleIcon width={20} height={20} />
          </span>
          <div>
            <div className="card-title">Gemini AI 추천</div>
            <div className="card-sub">{config.apiKey ? '연결됨 · 도착하면 맞춤 문구를 만들어요' : '키를 넣으면 맞춤 안내 문구가 켜져요'}</div>
          </div>
          <span className={`dot ${config.apiKey ? 'on' : ''}`} aria-hidden="true" />
        </div>
        <label>
          API 키
          <input
            type="password"
            autoComplete="off"
            value={config.apiKey}
            onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value.trim() })}
            placeholder="AIza…"
          />
        </label>
        <label>
          모델
          <input
            value={config.model}
            onChange={(e) => onConfigChange({ ...config, model: e.target.value.trim() })}
            onBlur={() => !config.model && onConfigChange({ ...config, model: DEFAULT_GEMINI_MODEL })}
          />
        </label>
        <button className="btn primary full" disabled={!config.apiKey || test.state === 'loading'} onClick={runTest}>
          {test.state === 'loading' ? '테스트 중…' : '연결 테스트'}
        </button>
        {test.state === 'ok' && <pre className="test-result ok">{test.text}</pre>}
        {test.state === 'error' && <pre className="test-result err">{test.text}</pre>}
        <p className="hint">
          키는 이 기기의 브라우저에만 저장돼요. 문구를 만들 때 매장명과 혜택 내용이, 캡처 등록 시에는 이미지(바코드 포함)가 Google Gemini로 전송돼요. 응답이 늦으면
          기본 문구를 보여드려요.
        </p>
      </div>

      <h2 className="section-title">캡처 등록 방식</h2>
      <div className="card">
        <div className="segmented" role="group" aria-label="캡처 인식 방식">
          <button className={scanMode === 'ondevice' ? 'on' : ''} aria-pressed={scanMode === 'ondevice'} onClick={() => onScanModeChange('ondevice')}>
            🔒 온디바이스
          </button>
          <button className={scanMode === 'gemini' ? 'on' : ''} aria-pressed={scanMode === 'gemini'} onClick={() => onScanModeChange('gemini')}>
            ✨ Gemini
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {scanMode === 'ondevice'
            ? '폰 안에서 바코드·글자를 읽어요. 이미지가 밖으로 나가지 않고 키도 필요 없어요. 처음 한 번 인식 모델(약 10MB)을 내려받아요.'
            : 'Gemini가 이미지를 읽어 더 정확하지만, 이미지(바코드 포함)가 Google로 전송돼요. API 키가 필요해요.'}
        </p>
      </div>

      <h2 className="section-title">시연 도구</h2>
      <div className="group">
        <button
          className="group-row"
          onClick={() => {
            resetNotified()
            flash('알림 기록을 초기화했어요')
          }}
        >
          <span className="row-icon blue">
            <BellIcon width={18} height={18} />
          </span>
          <span className="row-text">
            <b>알림 기록 초기화</b>
            <small>같은 매장에서 바로 다시 알림 받기</small>
          </span>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </button>
        <button
          className="group-row"
          onClick={() => {
            if (!confirm('등록한 혜택을 지우고 샘플로 되돌릴까요?')) return
            onResetSamples()
            flash('샘플 데이터로 초기화했어요')
          }}
        >
          <span className="row-icon pink">
            <RefreshIcon width={18} height={18} />
          </span>
          <span className="row-text">
            <b>샘플로 초기화</b>
            <small>시연용 멤버십·쿠폰으로 되돌리기 (만료일 갱신)</small>
          </span>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </button>
        <button className="group-row" onClick={onShowLanding}>
          <span className="row-icon blue">
            <InfoIcon width={18} height={18} />
          </span>
          <span className="row-text">
            <b>서비스 소개 보기</b>
            <small>처음 화면(랜딩페이지)으로 돌아가기</small>
          </span>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
      {notice && <div className="toast">{notice}</div>}

      <h2 className="section-title">알아두기</h2>
      <div className="group info">
        {[
          '화면이 켜져 있고 앱이 열려 있을 때 위치를 확인해요.',
          '실제 GPS는 HTTPS 주소에서만 동작해요.',
          '매장 정보는 OpenStreetMap에서 가져와요. 없는 매장은 레이더에서 직접 등록하세요.',
        ].map((t) => (
          <div key={t} className="group-row static">
            <span className="row-icon gray">
              <InfoIcon width={18} height={18} />
            </span>
            <span className="row-text">
              <small>{t}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
