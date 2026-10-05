import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { brandColor, brandMark, inkOn } from '../brands'
import { GEOFENCE_M, type NearbyStore } from '../nearby'
import type { LatLng } from '../types'

interface Props {
  position: LatLng
  accuracy: number | null
  follow: boolean
  stores: NearbyStore[]
  onMapClick?: (p: LatLng) => void
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const meIcon = L.divIcon({
  className: 'me-marker',
  html: '<span class="me-pulse"></span><span class="me-pulse delay"></span><span class="me-dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function storeIcon(brand: string, inside: boolean): L.DivIcon {
  const color = brandColor(brand)
  return L.divIcon({
    className: 'store-marker',
    html: `<span class="store-pin ${inside ? 'inside' : ''}" style="--c:${color};--ink:${inkOn(color)}"><b>${escapeHtml(brandMark(brand))}</b></span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    tooltipAnchor: [0, -40],
  })
}

function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function Follow({ position, enabled }: { position: LatLng; enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    // 내 위치가 화면 가장자리를 벗어날 때만 따라감 → 사용자가 지도를 직접 둘러볼 수 있음
    if (enabled && !map.getBounds().pad(-0.2).contains([position.lat, position.lng])) {
      map.panTo([position.lat, position.lng])
    }
  }, [map, position.lat, position.lng, enabled])
  return null
}

function StoreMarker({ n }: { n: NearbyStore }) {
  const brand = n.benefits[0].brand
  const inside = n.distance <= GEOFENCE_M
  const icon = useMemo(() => storeIcon(brand, inside), [brand, inside])
  return (
    <Marker position={[n.store.lat, n.store.lng]} icon={icon} keyboard={false}>
      <Tooltip direction="top">{n.store.name}</Tooltip>
    </Marker>
  )
}

export function MapPanel({ position, accuracy, follow, stores, onMapClick }: Props) {
  return (
    <MapContainer center={[position.lat, position.lng]} zoom={16} className="map" zoomControl={false}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ClickHandler onClick={onMapClick} />
      <Follow position={position} enabled={follow} />

      {stores.map(({ store, benefits }) => (
        <Circle
          key={store.id}
          center={[store.lat, store.lng]}
          radius={GEOFENCE_M}
          pathOptions={{ color: brandColor(benefits[0].brand), weight: 1.5, dashArray: '4 6', fillOpacity: 0.08 }}
          interactive={false}
        />
      ))}
      {stores.map((n) => (
        <StoreMarker key={`m-${n.store.id}`} n={n} />
      ))}

      {accuracy !== null && (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracy}
          pathOptions={{ color: '#5b6cff', weight: 0, fillOpacity: 0.1 }}
          interactive={false}
        />
      )}
      <Marker position={[position.lat, position.lng]} icon={meIcon} interactive={false} zIndexOffset={1000} />
    </MapContainer>
  )
}
