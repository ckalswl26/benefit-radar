import { useEffect, useRef } from 'react'
import '../landing.css'
import { BrandAvatar } from './BrandAvatar'
import { Mascot } from './Mascot'

interface Props {
  onStart: () => void
}

const PAINS = [
  { emoji: '⏰', title: '기프티콘, 또 만료', body: '선물받은 커피 쿠폰을 매장 앞을 지나면서도 까먹어요.' },
  { emoji: '💳', title: '멤버십 적립 깜빡', body: '계산하고 나서야 "아, 포인트!" 하고 떠올라요.' },
  { emoji: '🧩', title: '흩어진 할인 정보', body: '앱마다, 브랜드마다 행사가 달라 챙기기 어려워요.' },
]

const STEPS = [
  { n: 1, title: '캡처 한 장으로 등록', body: '기프티콘 캡처를 올리면 브랜드·만료일·바코드를 폰 안에서 읽어 채워요.', demo: 'scan' },
  { n: 2, title: '매장 앞에서 먼저 알림', body: '내 쿠폰을 쓸 수 있는 매장에 머무르면 지갑이가 톡 알려줘요.', demo: 'alert' },
  { n: 3, title: '바코드 바로 꺼내기', body: '알림을 누르면 계산대용 바코드가 크게. 쓴 만큼 절약 리포트에 쌓여요.', demo: 'barcode' },
] as const

const FEATURES = [
  { emoji: '📍', title: '위치 기반 도착 알림', body: '지나가는 길은 거르고, 매장 앞에 머물 때만 알려요.' },
  { emoji: '🔒', title: '온디바이스 캡처 인식', body: '바코드가 담긴 이미지는 폰 밖으로 나가지 않아요.' },
  { emoji: '✨', title: 'AI 맞춤 안내', body: 'Gemini가 만료 임박 쿠폰과 멤버십 조합을 골라 줘요.' },
  { emoji: '🛍️', title: '할인·이벤트 모아보기', body: '내 브랜드와 근처 매장의 행사를 출처와 함께 한눈에.' },
  { emoji: '🧾', title: '바코드 바로 보기', body: '화면이 꺼지지 않는 큰 바코드로 계산이 빨라져요.' },
  { emoji: '📊', title: '절약 리포트', body: '이번 달 아낀 금액과 놓친 쿠폰을 그래프로 보여줘요.' },
]

/** 스크롤 시 섹션이 부드럽게 나타나도록 (움직임 줄이기 설정이면 즉시 표시) */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('.reveal')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('shown'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('shown')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

function StepDemo({ kind }: { kind: (typeof STEPS)[number]['demo'] }) {
  if (kind === 'scan')
    return (
      <div className="demo demo-scan" aria-hidden="true">
        <div className="demo-photo">
          <span className="demo-photo-bar" />
          <span className="demo-photo-line" />
          <span className="demo-photo-line short" />
          <span className="demo-photo-code" />
          <span className="demo-scanline" />
        </div>
        <div className="demo-chip ok">✓ 스타벅스 · D-3</div>
      </div>
    )
  if (kind === 'alert')
    return (
      <div className="demo demo-alert" aria-hidden="true">
        <div className="noti">
          <BrandAvatar brand="스타벅스" size={34} />
          <div>
            <b>스타벅스 도착!</b>
            <small>아메리카노 쿠폰 3일 뒤 만료</small>
          </div>
        </div>
        <span className="demo-ring" />
      </div>
    )
  return (
    <div className="demo demo-barcode" aria-hidden="true">
      <span className="bars-lg" />
      <span className="demo-num">9310 2834 5512 0087</span>
      <span className="demo-chip saved">+4,500원 아꼈어요</span>
    </div>
  )
}

export function Landing({ onStart }: Props) {
  const ref = useReveal()

  return (
    <div className="landing" ref={ref}>
      <div className="blob b1" aria-hidden="true" />
      <div className="blob b2" aria-hidden="true" />
      <div className="blob b3" aria-hidden="true" />

      <nav className="l-nav">
        <a className="l-logo" href="#top" aria-label="혜택 레이더 홈">
          <Mascot size={40} />
          <span>혜택 레이더</span>
        </a>
        <button className="l-btn small" onClick={onStart}>
          앱 시작하기
        </button>
      </nav>

      <header className="l-hero" id="top">
        <div className="l-hero-copy">
          <span className="l-eyebrow">📍 위치 기반 스마트 지갑 도우미</span>
          <h1>
            지갑 속 혜택,
            <br />
            <span className="hl-mark">매장 앞에서</span> 먼저
            <br />
            알려줄게요
          </h1>
          <p className="l-lead">
            쿠폰·멤버십·기프티콘을 넣어 두면, 쓸 수 있는 매장에 도착했을 때 지갑이가 알려줘요. 더 이상 만료된 쿠폰에
            아쉬워하지 마세요.
          </p>
          <div className="l-cta-row">
            <button className="l-btn" onClick={onStart}>
              지금 시작하기 →
            </button>
            <a className="l-btn ghost" href="#how">
              어떻게 동작하나요?
            </a>
          </div>
          <div className="l-badges">
            <span>🔒 온디바이스 인식</span>
            <span>✨ Gemini AI</span>
            <span>🆓 설치 없이 웹에서</span>
          </div>
        </div>

        <div className="l-hero-art">
          <div className="hero-glow" aria-hidden="true" />
          <span className="wave w1" aria-hidden="true" />
          <span className="wave w2" aria-hidden="true" />
          <span className="wave w3" aria-hidden="true" />
          <Mascot size={340} float className="hero-mascot" alt="지도를 든 지갑 마스코트 지갑이" />
          <div className="float-card fc1" aria-hidden="true">
            <BrandAvatar brand="스타벅스" size={36} />
            <div>
              <b>스타벅스 도착!</b>
              <small>아메리카노 쿠폰 D-3</small>
            </div>
          </div>
          <div className="float-card fc2" aria-hidden="true">
            <BrandAvatar brand="CU" size={36} />
            <div>
              <b>근처 CU 140m</b>
              <small>멤버십 적립 잊지 마세요</small>
            </div>
          </div>
          <div className="float-card fc3" aria-hidden="true">
            <span className="fc-emoji">💰</span>
            <div>
              <b>이번 달 15,370원</b>
              <small>아꼈어요</small>
            </div>
          </div>
        </div>
      </header>

      <section className="l-section">
        <div className="l-head reveal">
          <span className="l-kicker">이런 적 있죠?</span>
          <h2>혜택은 있는데, 쓸 때는 꼭 잊어버려요</h2>
        </div>
        <div className="pain-grid">
          {PAINS.map((p, i) => (
            <article key={p.title} className="pain reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="pain-emoji">{p.emoji}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="l-section" id="how">
        <div className="l-head reveal">
          <span className="l-kicker">이렇게 동작해요</span>
          <h2>넣어 두기만 하면, 나머지는 지갑이가</h2>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <article key={s.n} className="step reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <StepDemo kind={s.demo} />
              <div className="step-body">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="l-section">
        <div className="l-head reveal">
          <span className="l-kicker">기능</span>
          <h2>놓치는 혜택 없이, 똑똑하게</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="feature reveal" style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <span className="feature-icon">{f.emoji}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="l-section">
        <div className="privacy reveal">
          <Mascot size={150} className="privacy-mascot" />
          <div>
            <span className="l-kicker">개인정보</span>
            <h2>민감한 쿠폰 정보는 폰 안에서만</h2>
            <ul>
              <li>기프티콘 캡처는 기기에서 직접 읽어요. 바코드 이미지가 서버로 가지 않아요.</li>
              <li>내 쿠폰·사용 기록은 이 기기 브라우저에만 저장돼요.</li>
              <li>공개된 할인·이벤트 정보만 인터넷에서 찾아와요.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="l-final reveal">
        <Mascot size={120} float />
        <h2>오늘부터, 놓치는 혜택 0개</h2>
        <p>가입 없이 바로 체험해 보세요. 시뮬레이션 모드로 걷지 않고도 둘러볼 수 있어요.</p>
        <button className="l-btn big" onClick={onStart}>
          혜택 레이더 시작하기
        </button>
      </section>

      <footer className="l-footer">
        <span>혜택 레이더 · 2026 AI 활용 아이디어 공모전 데모</span>
        <span>특정 카드사·간편결제 서비스와 무관한 독립 데모이며, 예시 데이터가 포함되어 있어요.</span>
      </footer>
    </div>
  )
}
