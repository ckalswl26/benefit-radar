/**
 * 온디바이스 쿠폰 인식: 이미지는 기기 밖으로 나가지 않는다.
 * - 바코드: 브라우저 BarcodeDetector(안드로이드 크롬 등) → 없으면 ZXing(JS)
 * - 글자: Tesseract.js(한국어+영어). 인식 모델만 처음 1회 내려받고 이후 브라우저에 캐시
 * - 정보 추출: 규칙 기반 (브랜드·만료일·종류·상품명)
 */
import { BRAND_PRESETS } from './brands'
import type { ExtractedCoupon } from './gemini'
import { nameMatchesKeyword } from './match'
import { localDate } from './storage'

export type ScanProgress = { stage: 'barcode' | 'model' | 'ocr'; pct: number }

const MAX_SIDE = 1600

async function toCanvas(file: File): Promise<HTMLCanvasElement> {
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
  return canvas
}

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new () => BarcodeDetectorLike

async function readBarcode(canvas: HTMLCanvasElement): Promise<string> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (Native) {
    try {
      const found = await new Native().detect(canvas)
      if (found[0]?.rawValue) return found[0].rawValue
    } catch {
      // 지원 형식 문제 등 → ZXing으로 재시도
    }
  }
  try {
    const { MultiFormatReader, BinaryBitmap, HybridBinarizer, HTMLCanvasElementLuminanceSource, DecodeHintType } =
      await import('@zxing/library')
    const reader = new MultiFormatReader()
    reader.setHints(new Map([[DecodeHintType.TRY_HARDER, true]]))
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)))).getText()
  } catch {
    return '' // 바코드 없음
  }
}

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>
let workerPromise: Promise<TesseractWorker> | null = null
let progressHandler: ((p: ScanProgress) => void) | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined
/** 모바일 메모리 절약: 1분간 안 쓰면 워커 종료 (다음 사용 시 캐시된 모델로 다시 생성) */
const IDLE_MS = 60_000

function scheduleIdleTerminate() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    const p = workerPromise
    workerPromise = null
    void p?.then((w) => w.terminate()).catch(() => {})
  }, IDLE_MS)
}

/** OCR 워커는 한 번 만들어 재사용 (모델 로딩이 가장 오래 걸림) */
function getWorker(): Promise<TesseractWorker> {
  workerPromise ??= import('tesseract.js')
    .then(({ createWorker }) =>
      createWorker(['kor', 'eng'], 1, {
        logger: (m) => {
          const pct = Math.round((m.progress ?? 0) * 100)
          progressHandler?.({ stage: m.status === 'recognizing text' ? 'ocr' : 'model', pct })
        },
      }),
    )
    .catch((e: unknown) => {
      workerPromise = null
      throw new Error(`인식 모델을 불러오지 못했어요 (첫 사용은 인터넷 필요): ${e instanceof Error ? e.message : String(e)}`)
    })
  return workerPromise
}

const HANGUL = /[가-힣]/
const NOISE = /유효\s*기간|교환\s*처|주문\s*번호|바코드|사용\s*처|선물|보낸\s*사람|받는\s*사람|발신|수신|기프티콘|gifticon|카카오톡|유의\s*사항|www\.|https?:/i

/** OCR이 한글 글자 사이에 넣는 공백 제거 ("스 타 벅 스" → "스타벅스") */
function squeezeHangul(line: string): string {
  const tokens = line.split(/\s+/).filter(Boolean)
  const singles = tokens.filter((t) => t.length === 1 && HANGUL.test(t)).length
  return tokens.length >= 3 && singles / tokens.length > 0.6 ? tokens.join('') : line
}

function findExpiry(text: string): string {
  const dates = [...text.matchAll(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g)]
    .map((m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
    .filter((s) => {
      const d = new Date(s + 'T00:00:00')
      return !Number.isNaN(d.getTime()) && localDate(d) === s
    })
    .sort()
  // 발행일·만료일이 같이 있으면 가장 늦은 날짜가 만료일
  return dates[dates.length - 1] ?? ''
}

function findBrand(text: string, compact: string): string {
  for (const p of BRAND_PRESETS) {
    if (p.keywords.some((k) => nameMatchesKeyword(text, k) || (HANGUL.test(k) && compact.includes(k)))) return p.brand
  }
  return ''
}

function findTitle(lines: string[], brand: string): string {
  const PRODUCT = /아메리카노|라떼|커피|음료|케이크|교환권|쿠폰|할인|원|세트|버거|아이스크림|기프트|상품권|티켓|\d+\s*(ml|g|개)/i
  const candidates = lines
    .map((l) => l.replace(/[|_~`"'<>[\]{}]/g, '').trim())
    .filter((l) => l.length >= 2 && l.length <= 40 && HANGUL.test(l) && !NOISE.test(l))
    .filter((l) => !/^\d[\d\s.\-/]*$/.test(l) && !/(20\d{2})\s*[.\-/년]/.test(l))
    .filter((l) => l.replace(/\s/g, '') !== brand)
  const scored = candidates
    .map((l) => ({ l, score: (PRODUCT.test(l) ? 10 : 0) + (l.match(/[가-힣]/g)?.length ?? 0) }))
    .sort((a, b) => b.score - a.score)
  return (scored[0]?.l ?? '')
    .replace(new RegExp(`^${brand}\\s*`), '')
    // OCR이 영문·기호를 낱자모(ㅠ, ㅣ 등)로 오인식한 조각 제거
    .replace(/(^|\s)[ㄱ-ㅎㅏ-ㅣ]+(?=\s|$)/g, ' ')
    .trim()
    .slice(0, 40)
}

/** OCR 텍스트 → 쿠폰 정보 (테스트하기 쉽게 분리) */
export function parseCouponText(raw: string, barcode: string): ExtractedCoupon {
  const lines = raw
    .split('\n')
    .map((l) => squeezeHangul(l.trim()))
    .filter(Boolean)
  const text = lines.join('\n')
  const compact = text.replace(/\s/g, '')
  const brand = findBrand(text, compact)
  const kind = /멤버십|회원\s*카드|포인트|적립\s*카드|membership/i.test(text) ? 'membership' : 'coupon'
  // 화면 바코드를 못 읽었을 때만: 노이즈 줄(주문번호 등)을 뺀 줄에서 12~20자리 숫자
  const digits =
    barcode ||
    lines
      .filter((l) => !NOISE.test(l))
      .flatMap((l) => l.match(/\d[\d \t-]{10,}\d/g) ?? [])
      .map((s) => s.replace(/[^\d]/g, ''))
      .find((s) => s.length >= 12 && s.length <= 20) ||
    ''
  return {
    brand,
    kind,
    title: findTitle(lines, brand),
    expiresAt: kind === 'coupon' ? findExpiry(text) : '',
    barcode: digits.replace(/[^0-9A-Za-z]/g, '').slice(0, 40),
  }
}

/** 캡처 이미지에서 쿠폰 정보 추출 (전부 기기 안에서 처리) */
export async function readCouponOnDevice(file: File, onProgress: (p: ScanProgress) => void): Promise<ExtractedCoupon> {
  const canvas = await toCanvas(file)
  onProgress({ stage: 'barcode', pct: 0 })
  const barcode = await readBarcode(canvas)
  progressHandler = onProgress
  clearTimeout(idleTimer)
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(canvas)
    const result = parseCouponText(data.text, barcode)
    if (!result.brand && !result.title && !result.barcode) throw new Error('쿠폰 정보를 찾지 못했어요. 더 선명한 캡처로 시도해 주세요.')
    return result
  } finally {
    progressHandler = null
    scheduleIdleTerminate()
  }
}
