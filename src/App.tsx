import { useEffect, useMemo, useState } from 'react'
import { useArrivalDetector } from './arrival'
import { ArrivalSheet, type Arrival } from './components/ArrivalSheet'
import { BarcodeSheet } from './components/BarcodeSheet'
import type { ScanMode } from './components/BenefitForm'
import { RadarView } from './components/RadarView'
import { ReportView } from './components/ReportView'
import { SettingsView } from './components/SettingsView'
import { DEFAULT_GEMINI_MODEL, geminiMessage, type GeminiConfig } from './gemini'
import { WalletView } from './components/WalletView'
import { ChartIcon, GearIcon, RadarIcon, TagIcon, WalletIcon } from './components/icons'
import { EventsView } from './components/EventsView'
import { Landing } from './components/Landing'
import { usePosition, useOsmStores, type PosMode } from './hooks'
import { ruleMessage } from './message'
import { matchNearby, type NearbyStore } from './nearby'
import { registerServiceWorker, showSystemNotification, vibrate } from './notify'
import { isActive, isBenefitList, isStoreList, loadJson, sampleBenefits, saveJson } from './storage'
import type { Benefit, Store } from './types'
import { formatWon, isUsageList, makeLog, sampleUsage, type UsageLog } from './usage'

type Tab = 'radar' | 'events' | 'wallet' | 'report' | 'settings'

const TABS = [
  { id: 'radar', label: '레이더', Icon: RadarIcon },
  { id: 'events', label: '혜택', Icon: TagIcon },
  { id: 'wallet', label: '지갑', Icon: WalletIcon },
  { id: 'report', label: '리포트', Icon: ChartIcon },
  { id: 'settings', label: '설정', Icon: GearIcon },
] as const satisfies readonly { id: Tab; label: string; Icon: unknown }[]

const BENEFITS_KEY = 'br.benefits'
const CUSTOM_STORES_KEY = 'br.customStores'
const GEMINI_KEY = 'br.gemini'
const USAGE_KEY = 'br.usage'
const SCAN_MODE_KEY = 'br.scanMode'
/** 할인·이벤트 검색 시 내 지갑 브랜드 다음으로 채울 인기 브랜드 */
const POPULAR_BRANDS = ['CU', 'GS25', '스타벅스', '올리브영', '다이소', '메가커피']
const EVENT_BRAND_LIMIT = 8

function isGeminiConfig(v: unknown): v is GeminiConfig {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as GeminiConfig).apiKey === 'string' &&
    typeof (v as GeminiConfig).model === 'string'
  )
}

const ENTERED_KEY = 'br.entered'

/** 첫 방문은 랜딩페이지, 시작하기 이후엔 바로 앱 (앱 본체를 분리해 랜딩에서 위치 권한을 묻지 않음) */
export default function App() {
  const [entered, setEntered] = useState(() => loadJson(ENTERED_KEY, false, (v): v is boolean => typeof v === 'boolean'))
  useEffect(() => {
    saveJson(ENTERED_KEY, entered)
    window.scrollTo(0, 0)
  }, [entered])

  function start() {
    // 랜딩 앵커(#how 등)가 주소에 남지 않게
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
    setEntered(true)
  }

  if (!entered) return <Landing onStart={start} />
  return <MainApp onShowLanding={() => setEntered(false)} />
}

function MainApp({ onShowLanding }: { onShowLanding: () => void }) {
  const [tab, setTab] = useState<Tab>('radar')
  const [benefits, setBenefits] = useState<Benefit[]>(() => loadJson(BENEFITS_KEY, sampleBenefits(), isBenefitList))
  const [customStores, setCustomStores] = useState<Store[]>(() => loadJson(CUSTOM_STORES_KEY, [], isStoreList))
  const [mode, setMode] = useState<PosMode>('gps')
  const [arrival, setArrival] = useState<Arrival | null>(null)
  const [barcodeFor, setBarcodeFor] = useState<Benefit | null>(null)
  const [usage, setUsage] = useState<UsageLog[]>(() => loadJson(USAGE_KEY, sampleUsage(), isUsageList))
  const [toast, setToast] = useState('')
  useEffect(() => saveJson(USAGE_KEY, usage), [usage])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  function markUsed(b: Benefit, amount: number) {
    setUsage((prev) => [makeLog(b, amount), ...prev])
    // 쿠폰은 1회용 → 사용 완료 표시(매칭·알림에서 제외). 멤버십은 계속 사용
    if (b.kind === 'coupon') setBenefits((prev) => prev.map((x) => (x.id === b.id ? { ...x, usedAt: Date.now() } : x)))
    setBarcodeFor(null)
    setArrival(null)
    setToast(amount > 0 ? `${formatWon(amount)} 아꼈어요! 🎉` : '사용 완료로 기록했어요 ✅')
  }
  const [gemini, setGemini] = useState<GeminiConfig>(() =>
    loadJson(GEMINI_KEY, { apiKey: '', model: DEFAULT_GEMINI_MODEL }, isGeminiConfig),
  )
  useEffect(() => saveJson(GEMINI_KEY, gemini), [gemini])
  const [scanMode, setScanMode] = useState<ScanMode>(() =>
    loadJson<ScanMode>(SCAN_MODE_KEY, 'ondevice', (v): v is ScanMode => v === 'ondevice' || v === 'gemini'),
  )
  useEffect(() => saveJson(SCAN_MODE_KEY, scanMode), [scanMode])

  useEffect(registerServiceWorker, [])

  useEffect(() => saveJson(BENEFITS_KEY, benefits), [benefits])
  useEffect(() => saveJson(CUSTOM_STORES_KEY, customStores), [customStores])

  const pos = usePosition(mode)
  // 만료된 쿠폰은 검색·매칭·알림에서 제외
  const activeBenefits = useMemo(() => benefits.filter(isActive), [benefits])
  const keywords = useMemo(() => activeBenefits.flatMap((b) => b.keywords), [activeBenefits])
  const osm = useOsmStores(pos.position, keywords)
  const nearby = useMemo(
    () => matchNearby([...customStores, ...osm.stores], activeBenefits, pos.position),
    [customStores, osm.stores, activeBenefits, pos.position],
  )

  const walletBrands = useMemo(() => [...new Set(activeBenefits.map((b) => b.brand))], [activeBenefits])
  const eventBrands = useMemo(
    () => [...new Set([...walletBrands, ...POPULAR_BRANDS])].slice(0, EVENT_BRAND_LIMIT),
    [walletBrands],
  )
  const nearbyBrands = useMemo(() => [...new Set(nearby.map((n) => n.benefits[0].brand))], [nearby])

  function handleArrive(n: NearbyStore) {
    const id = crypto.randomUUID()
    const fallback = ruleMessage(n.store.name, n.benefits)
    vibrate()
    if (!gemini.apiKey) {
      setArrival({ id, nearby: n, message: fallback, ai: 'off' })
      void showSystemNotification(fallback.title, fallback.body, n.store.id)
      return
    }
    // 기본 문구로 즉시 표시하고, AI 문구가 오면 교체
    setArrival({ id, nearby: n, message: fallback, ai: 'loading' })
    geminiMessage(gemini, n.store.name, n.benefits)
      .then((message) => {
        setArrival((cur) => (cur?.id === id ? { ...cur, message, ai: 'done' } : cur))
        void showSystemNotification(message.title, message.body, n.store.id)
      })
      .catch(() => {
        setArrival((cur) => (cur?.id === id ? { ...cur, ai: 'failed' } : cur))
        void showSystemNotification(fallback.title, fallback.body, n.store.id)
      })
  }

  useArrivalDetector({ nearby, position: pos.position, accuracy: pos.accuracy, mode, onArrive: handleArrive })

  function addCustomStore(name: string) {
    if (!pos.position) return
    const store: Store = { id: `custom-${crypto.randomUUID()}`, name, matchText: name, ...pos.position, source: 'custom' }
    setCustomStores((prev) => [store, ...prev])
  }

  return (
    <div className="app">
      <main>
        {tab === 'radar' && (
          <RadarView
            mode={mode}
            onModeChange={setMode}
            pos={pos}
            nearby={nearby}
            osmStatus={osm.status}
            onRetry={osm.refetch}
            onAddCustomStore={addCustomStore}
            onDeleteCustomStore={(id) => setCustomStores((prev) => prev.filter((s) => s.id !== id))}
          />
        )}
        {tab === 'events' && (
          <EventsView gemini={gemini} brands={eventBrands} walletBrands={walletBrands} nearbyBrands={nearbyBrands} />
        )}
        {tab === 'wallet' && (
          <WalletView
            benefits={benefits}
            onAdd={(b) => setBenefits((prev) => [b, ...prev])}
            onDelete={(id) => setBenefits((prev) => prev.filter((b) => b.id !== id))}
            onOpen={setBarcodeFor}
            gemini={gemini}
            scanMode={scanMode}
            usage={usage}
            onGoReport={() => setTab('report')}
          />
        )}
        {tab === 'report' && <ReportView benefits={benefits} usage={usage} />}
        {tab === 'settings' && (
          <SettingsView
            config={gemini}
            onConfigChange={setGemini}
            scanMode={scanMode}
            onScanModeChange={setScanMode}
            onShowLanding={onShowLanding} onResetSamples={() => {
              setBenefits(sampleBenefits())
              setUsage(sampleUsage())
            }} />
        )}
      </main>

      {arrival && <ArrivalSheet arrival={arrival} onClose={() => setArrival(null)} onOpen={setBarcodeFor} />}
      {barcodeFor && <BarcodeSheet benefit={barcodeFor} onClose={() => setBarcodeFor(null)} onUse={markUsed} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="tabbar" aria-label="메뉴">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon width={22} height={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
