const MAX_SIDE = 1280

/** 이미지 파일을 긴 변 1280px 이하 JPEG(base64)로 줄인다 — 업로드 용량·지연 감소 */
export async function fileToJpegBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이미지를 열 수 없어요. JPG·PNG 캡처로 올려 주세요.')
  })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { mimeType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
