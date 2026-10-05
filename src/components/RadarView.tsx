import { useState } from 'react'
import { formatDistance } from '../geo'
import type { FetchStatus, PosMode, PositionState } from '../hooks'
import { GEOFENCE_M, type NearbyStore } from '../nearby'
import { notificationSupported, requestNotificationPermission } from '../notify'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'
import { BellIcon, PinIcon, PlusIcon, RefreshIcon, TrashIcon, WalkIcon } from './icons'
import { MapPanel } from './MapPanel'

interface Props {
  mode: PosMode
  onModeChange: (m: PosMode) => void
  pos: PositionState
  nearby: NearbyStore[]
  osmStatus: FetchStatus
  onRetry: () => void
  onAddCustomStore: (name: string) => void
  onDeleteCustomStore: (id: string) => void
}

export function RadarView({ mode, onModeChange, pos, nearby, osmStatus, onRetry, onAddCustomStore, onDeleteCustomStore }: Props) {
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [permission, setPermission] = useState(() => (notificationSupported() ? Notification.permission : 'denied'))
  const { position } = pos
  const here = nearby.filter((n) => n.distance <= GEOFENCE_M).length

  let statusText: string
  if (mode === 'gps' && pos.error) statusText = pos.error
  else if (osmStatus === 'loading') statusText = '주변 매장을 찾는 중…'
  else if (osmStatus === 'error') statusText = '검색이 느려요 · 이전 결과 표시 중'
  else if (mode === 'sim') statusText = pos.walking ? '걸어가는 중… 🚶' : '지도를 탭하면 그곳으로 이동해요'
  else statusText = pos.accuracy !== null ? `GPS 정확도 ±${Math.round(pos.accuracy)}m` : '위치 확인 중…'
  const statusErr = (mode === 'gps' && !!pos.error) || osmStatus === 'error'

  return (
    <section className="view">
      <header className="page-head">
        <div>
          <h1 className="page-title">혜택 레이더</h1>
          <p className="page-sub">
            {nearby.length > 0 ? (
              <>
                근처에 쓸 수 있는 혜택 매장 <b className="hl">{nearby.length}곳</b>
              </>
            ) : (
              '근처 매장에서 내 혜택을 찾아드려요'
            )}
          </p>
        </div>
        <Mascot size={64} float className="head-mascot" />
      </header>

      <div className="map-card">
        {position ? (
          <MapPanel
            position={position}
            accuracy={pos.accuracy}
            follow={mode === 'gps'}
            stores={nearby}
            onMapClick={mode === 'sim' ? pos.setSimPosition : undefined}
          />
        ) : (
          <div className="map map-placeholder">
            <Mascot size={120} float />
            <span>{pos.error ?? '현재 위치를 찾고 있어요…'}</span>
            {pos.error && (
              <button className="btn soft sm" onClick={() => onModeChange('sim')}>
                🕹️ 시뮬레이션으로 둘러보기
              </button>
            )}
          </div>
        )}

        <div className="map-overlay top">
          <div className="segmented glass">
            <button className={mode === 'gps' ? 'on' : ''} onClick={() => onModeChange('gps')}>
              📡 실제 GPS
            </button>
            <button className={mode === 'sim' ? 'on' : ''} onClick={() => onModeChange('sim')}>
              🕹️ 시뮬레이션
            </button>
          </div>
        </div>
        <div className="map-overlay bottom" hidden={!position}>
          <span className={`status-pill ${statusErr ? 'err' : ''}`}>
            {osmStatus === 'loading' && <span className="spinner" aria-hidden="true" />}
            {statusText}
          </span>
          {osmStatus === 'error' && (
            <button className="round-btn" onClick={onRetry} aria-label="다시 검색">
              <RefreshIcon width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {permission === 'default' && (
        <div className="banner">
          <span className="banner-icon">
            <BellIcon width={20} height={20} />
          </span>
          <span className="banner-text">매장에 도착하면 알림으로 알려드릴게요</span>
          <button className="btn primary sm" onClick={() => requestNotificationPermission().then(setPermission)}>
            켜기
          </button>
        </div>
      )}

      <div className="section-row">
        <h2 className="section-title">근처 혜택 매장</h2>
        {here > 0 && <span className="pill here">도착 {here}</span>}
      </div>

      {nearby.length === 0 && osmStatus !== 'loading' && (
        <div className="empty-card">
          <Mascot size={110} float />
          <p>반경 600m 안에 내 혜택을 쓸 수 있는 매장이 없어요.</p>
        </div>
      )}

      <div className="list">
        {nearby.slice(0, 20).map(({ store, benefits, distance }) => {
          const inside = distance <= GEOFENCE_M
          return (
            <div key={store.id} className={`store-card ${inside ? 'inside' : ''}`}>
              <BrandAvatar brand={benefits[0].brand} size={46} />
              <div className="store-info">
                <div className="store-name">
                  {store.name}
                  {inside && <span className="pill here">도착!</span>}
                </div>
                <div className="store-benefits">{benefits.map((b) => b.title).join(' · ')}</div>
              </div>
              <div className="store-side">
                <span className="dist">
                  <PinIcon width={13} height={13} />
                  {formatDistance(distance)}
                </span>
                {mode === 'sim' && !inside && (
                  <button className="btn soft sm" onClick={() => pos.walkTo({ lat: store.lat, lng: store.lng })}>
                    <WalkIcon width={15} height={15} /> 가기
                  </button>
                )}
                {store.source === 'custom' && (
                  <button className="round-btn ghost" onClick={() => onDeleteCustomStore(store.id)} aria-label={`${store.name} 삭제`}>
                    <TrashIcon width={16} height={16} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showCustom ? (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!customName.trim()) return
            onAddCustomStore(customName.trim())
            setCustomName('')
            setShowCustom(false)
          }}
        >
          <label>
            지금 서 있는 곳을 매장으로 등록해요
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="예: 스타벅스 역삼점"
              autoFocus
            />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn ghost" onClick={() => setShowCustom(false)}>
              취소
            </button>
            <button className="btn primary grow" disabled={!customName.trim() || !position}>
              현재 위치에 등록
            </button>
          </div>
        </form>
      ) : (
        <button className="add-row" onClick={() => setShowCustom(true)}>
          <PlusIcon width={18} height={18} /> 지도에 없는 매장 등록하기
        </button>
      )}
    </section>
  )
}
