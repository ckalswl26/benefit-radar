import { useEffect, useRef, useState } from 'react'
import { DEFAULT_POSITION, distanceM } from './geo'
import { SEARCH_RADIUS_M } from './nearby'
import { fetchStores } from './overpass'
import { isStoreList, loadJson, saveJson } from './storage'
import type { LatLng, Store } from './types'

export type PosMode = 'gps' | 'sim'

export interface PositionState {
  position: LatLng | null
  accuracy: number | null
  error: string | null
  setSimPosition: (p: LatLng) => void
  /** 시뮬레이션: 목적지까지 빠르게 걸어가는 애니메이션 */
  walkTo: (dest: LatLng) => void
  walking: boolean
}

const WALK_TICK_MS = 200
/** 시연용 배속 걸음 (틱당 m) */
const WALK_STEP_M = 8

export function usePosition(mode: PosMode): PositionState {
  const [gps, setGps] = useState<{ position: LatLng; accuracy: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [sim, setSim] = useState<LatLng | null>(null)

  const [walkDest, setWalkDest] = useState<LatLng | null>(null)
  const [walkMode, setWalkMode] = useState(mode)
  if (walkMode !== mode) {
    setWalkMode(mode)
    setWalkDest(null)
  }
  const unsupported = !window.isSecureContext || !('geolocation' in navigator)
  const simPos = sim ?? gps?.position ?? DEFAULT_POSITION
  const simPosRef = useRef(simPos)
  useEffect(() => {
    simPosRef.current = simPos
  })

  useEffect(() => {
    if (!walkDest || mode !== 'sim') return
    const id = setInterval(() => {
      const from = simPosRef.current
      const d = distanceM(from, walkDest)
      if (d <= WALK_STEP_M) {
        setSim(walkDest)
        setWalkDest(null)
        return
      }
      const r = WALK_STEP_M / d
      const next = { lat: from.lat + (walkDest.lat - from.lat) * r, lng: from.lng + (walkDest.lng - from.lng) * r }
      simPosRef.current = next
      setSim(next)
    }, WALK_TICK_MS)
    return () => clearInterval(id)
  }, [walkDest, mode])

  useEffect(() => {
    if (mode !== 'gps' || unsupported) return
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps({ position: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy })
        setGpsError(null)
      },
      (e) => setGpsError(e.code === e.PERMISSION_DENIED ? '위치 권한이 거부되었습니다.' : `위치를 가져오지 못했습니다 (${e.message})`),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [mode, unsupported])

  function setSimPosition(p: LatLng) {
    setWalkDest(null)
    setSim(p)
  }

  if (mode === 'gps') {
    const error = unsupported ? 'GPS를 쓰려면 HTTPS(또는 localhost)로 접속해야 합니다.' : gpsError
    return { position: gps?.position ?? null, accuracy: gps?.accuracy ?? null, error, setSimPosition, walkTo: setWalkDest, walking: false }
  }
  // 시뮬레이션: 마지막 GPS 위치(없으면 강남역)에서 시작
  return { position: simPos, accuracy: null, error: null, setSimPosition, walkTo: setWalkDest, walking: walkDest !== null }
}

const REFETCH_DISTANCE_M = 250

export type FetchStatus = 'idle' | 'loading' | 'ok' | 'error'

/** 위치가 일정 거리 이상 바뀌거나 키워드가 바뀌면 주변 매장을 다시 검색 */
const OSM_CACHE_KEY = 'br.osmCache'

export function useOsmStores(position: LatLng | null, keywords: string[]) {
  // 마지막 검색 결과를 캐시 → 네트워크가 불안정한 시연 환경에서도 바로 표시
  const [stores, setStores] = useState<Store[]>(() => loadJson(OSM_CACHE_KEY, [], isStoreList))
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [target, setTarget] = useState<{ center: LatLng; key: string } | null>(null)
  const key = [...new Set(keywords)].sort().join('|')

  // 렌더 중 상태 조정: 일정 거리 이상 이동했거나 키워드가 바뀌었을 때만 새 검색 지점으로 교체
  if (
    position &&
    (!target || target.key !== key || distanceM(target.center, position) > REFETCH_DISTANCE_M)
  ) {
    setTarget({ center: position, key })
  }

  useEffect(() => {
    if (!target) return
    const ctrl = new AbortController()
    // 시뮬레이션에서 연속 이동 시 요청이 몰리지 않도록 잠시 대기
    const timer = setTimeout(() => {
      setStatus('loading')
      fetchStores(target.center, SEARCH_RADIUS_M, target.key ? target.key.split('|') : [], ctrl.signal)
        .then((s) => {
          if (ctrl.signal.aborted) return
          setStores(s)
          saveJson(OSM_CACHE_KEY, s)
          setStatus('ok')
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setStatus('error')
        })
    }, 600)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [target])

  const refetch = () => setTarget((prev) => (prev ? { ...prev } : prev))
  return { stores, status, refetch }
}
