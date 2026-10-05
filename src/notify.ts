/** 시스템 알림. Android Chrome은 `new Notification()`을 막으므로 서비스워커로 띄운다. */

export function notificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // 등록 실패 시 앱 내 알림만 사용
  })
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  return Notification.requestPermission()
}

export async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  // 앱 화면을 보고 있으면 앱 내 시트로 충분
  if (document.visibilityState === 'visible') return
  if (!notificationSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, { body, tag, icon: `${import.meta.env.BASE_URL}icon-192.png` })
  } catch {
    // 알림 실패는 앱 내 시트로 대체
  }
}

export function vibrate(): void {
  navigator.vibrate?.([200, 100, 200])
}
