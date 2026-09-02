import Link from 'next/link';

/**
 * Landing page.
 *
 * Copy is fixed by docs/brand/MESSAGING.md §3 — do not paraphrase it here.
 * Section 4 (the approval promise) is included deliberately: the approval gate
 * is a reason to trust the product, not a weakness to hide (BRAND.md §11).
 */
export default function Home() {
  return (
    <main>
      <section className="wrap hero">
        <h1>사장님에서, 회장님으로.</h1>
        <p className="sub">이제 직접 하지 말고, 지시하세요.</p>
        <p className="lede">
          MYCORP24는 마케팅, 영업, 재무, 운영, 전략 등 회사에 필요한 AI 조직이
          365일 24시간 움직이는 <strong>당신의 AI 회사</strong>입니다.
        </p>
        <Link className="cta" href="/signup">
          내 AI 회사 만들기
        </Link>
      </section>

      <section className="band paper">
        <div className="wrap">
          <h2>사장인데, 왜 모든 일을 직접 하고 계십니까?</h2>
          <ul className="plain">
            <li>마케팅도 직접.</li>
            <li>영업도 직접.</li>
            <li>자료조사도 직접.</li>
            <li>고객관리도 직접.</li>
            <li>보고서도 직접.</li>
          </ul>
          <p className="direct">이제 회사가 일하게 하세요.</p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>YOU CLOCK OUT. WE DON&apos;T.</h2>
          <p>
            당신이 퇴근해도 MYCORP24의 AI 조직은 계속 움직입니다. 시장 변화를
            살피고, 데이터를 분석하고, 기회를 찾고, 다음 업무를 준비합니다.
          </p>
          <p className="direct">365일 24시간. Your Company. Always On.</p>
        </div>
      </section>

      <section className="band paper">
        <div className="wrap">
          <h2>AI가 준비하고, 회장이 결재하고, 회사가 실행합니다.</h2>
          <p>
            돈이 나가는 일, 고객에게 나가는 일, 밖으로 공개되는 일은 반드시
            회장님의 결재를 거칩니다.
          </p>
          <p className="rule-line">
            AI prepares. &nbsp;Founder approves. &nbsp;Company executes.
          </p>
        </div>
      </section>
    </main>
  );
}
