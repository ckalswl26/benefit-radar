import { useEffect, useRef } from 'react'
import { distanceM } from './geo'
import type { PosMode } from './hooks'
import type { LatLng } from './types'
import { GEOFENCE_M, type NearbyStore } from './nearby'
import { loadJson, saveJson } from './storage'

/** 반경 안에 이 시간 이상 머물러야 "도착" */
const DWELL_MS: Record<PosMode, number> = { gps: 15_000, sim: 3_000 }
/** GPS: 최근 STILL_WINDOW_MS 동안 max(STILL_MAX_M, 정확도) 이상 움직였으면 지나가는 중으로 보고 보류 (실내 GPS 튐 허용) */
const STILL_WINDOW_MS = 15_000
const STILL_MAX_M = 20
/** 경계에서 들락날락하며 체류 시간이 초기화되지 않도록 이탈 판정은 더 바깥에서 */
const EXIT_HYSTERESIS_M = 20
/** GPS 오차가 이보다 크면 판정하지 않음 */
const MAX_ACCURACY_M = 80
/** 같은 혜택 묶음은 이 시간 동안 다시 알리지 않음 */
const COOLDOWN_MS = 30 * 60_000
const NOTIFIED_KEY = 'br.notified'

type NotifiedMap = Record<string, number>

function isNotifiedMap(v: unknown): v is NotifiedMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((t) => typeof t === 'number')
}

export function resetNotified(): void {
  saveJson(NOTIFIED_KEY, {})
}

function benefitKey(n: NearbyStore): string {
  return n.benefits
    .map((b) => b.id)
    .sort()
    .join(',')
}

interface Inputs {
  nearby: NearbyStore[]
  position: LatLng | null
  accuracy: number | null
  mode: PosMode
  onArrive: (n: NearbyStore) => void
}

/** 매장 반경 진입 + 체류 시간 + 쿨다운으로 도착을 판정 (1초 주기, 탭과 무관하게 동작) */
export function useArrivalDetector(inputs: Inputs): void {
  const latest = useRef(inputs)
  const entered = useRef(new Map<string, number>())
  const track = useRef<{ t: number; p: LatLng }[]>([])

  useEffect(() => {
    latest.current = inputs
  })

  useEffect(() => {
    const id = setInterval(() => {
      const { nearby, position, accuracy, mode, onArrive } = latest.current
      const now = Date.now()
      if (position) {
        track.current.push({ t: now, p: position })
        track.current = track.current.filter((s) => now - s.t <= STILL_WINDOW_MS)
      }
      if (mode === 'gps' && (accuracy === null || accuracy > MAX_ACCURACY_M)) return
      const oldest = track.current[0]
      const moving = mode === 'gps' && position !== null && oldest !== undefined && distanceM(oldest.p, position) > Math.max(STILL_MAX_M, accuracy ?? 0)

      const present = new Set(nearby.map((n) => n.store.id))
      for (const storeId of entered.current.keys()) {
        if (!present.has(storeId)) entered.current.delete(storeId)
      }

      const notified = loadJson<NotifiedMap>(NOTIFIED_KEY, {}, isNotifiedMap)
      for (const n of nearby) {
        const id = n.store.id
        if (n.distance > GEOFENCE_M + EXIT_HYSTERESIS_M) {
          entered.current.delete(id)
          continue
        }
        if (n.distance <= GEOFENCE_M && !entered.current.has(id)) entered.current.set(id, now)

        const since = entered.current.get(id)
        if (since === undefined || now - since < DWELL_MS[mode] || moving) continue

        // 혜택 묶음 + 매장 단위 쿨다운 (쿠폰을 쓴 직후 묶음이 바뀌어도 같은 매장은 다시 알리지 않음)
        const key = benefitKey(n)
        const storeKey = `store:${id}`
        const recent = [notified[key], notified[storeKey]].some((t) => t !== undefined && now - t < COOLDOWN_MS)
        if (recent) continue

        notified[key] = now
        notified[storeKey] = now
        for (const [k, t] of Object.entries(notified)) if (now - t >= COOLDOWN_MS) delete notified[k]
        saveJson(NOTIFIED_KEY, notified)
        onArrive(n)
        break // 한 번에 하나씩
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])
}
