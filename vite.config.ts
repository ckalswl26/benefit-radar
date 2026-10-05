import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// `pnpm phone`: 같은 Wi-Fi의 폰에서 접속할 수 있도록 HTTPS(자체 서명) + LAN 공개.
// 브라우저 GPS·알림은 HTTPS에서만 동작한다.
export default defineConfig(({ mode }) => ({
  // 상대 경로 빌드 → 루트/하위 경로 어디에 정적 배포해도 동작
  base: './',
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
}))
