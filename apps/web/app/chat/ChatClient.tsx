'use client';

import { useRef, useState } from 'react';
import type { RouterResult } from '@mycorp24/chat';

type Turn =
  | { readonly who: 'founder'; readonly text: string }
  | { readonly who: 'staff'; readonly result: RouterResult };

const SUGGESTIONS = [
  '결재할 거 있어?',
  '인스타 연결해',
  '이번 달 광고비 알려줘',
  '직원들 뭐하고 있어?',
  '광고비 30만원 넘으면 물어봐',
  '알아서 처리하고 중요한 것만 보고해',
];

function Cards({ result }: { result: RouterResult }) {
  if (result.cards.length === 0) return null;
  return (
    <div className="cards">
      {result.cards.map((card, i) => {
        switch (card.kind) {
          case 'APPROVAL_LIST':
            return (
              <div className="card" key={i}>
                <div className="card-label">결재 대기</div>
                {card.approvals.map((a) => (
                  <div className="card-row" key={a.id}>
                    <span>{a.title}</span>
                    {a.amount !== undefined && (
                      <span className="mono">{a.amount.toLocaleString('ko-KR')}원</span>
                    )}
                  </div>
                ))}
              </div>
            );
          case 'METRIC':
            return (
              <div className="card" key={i}>
                <div className="card-label">{card.period} · {card.metric}</div>
                <div className="card-row">
                  {card.ready ? '데이터본부에서 집계 중입니다.' : '연결된 데이터 소스가 없습니다.'}
                </div>
              </div>
            );
          case 'AGENT_STATUS':
            return (
              <div className="card" key={i}>
                <div className="card-label">AI 직원</div>
                <div className="card-row">{card.working}명 업무 중</div>
              </div>
            );
          case 'CONNECT':
            return (
              <div className="card" key={i}>
                <div className="card-label">연결</div>
                <div className="card-row">
                  <span>{card.provider}</span>
                  <span className="mono">{card.connected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
                </div>
              </div>
            );
          case 'DRAFT':
            return (
              <div className="card" key={i}>
                <div className="card-label">
                  {card.needsApproval ? '초안 · 결재 대기' : '초안'}
                </div>
                <div className="card-row" style={{ fontWeight: 600 }}>{card.title}</div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: '0.5rem 0 0',
                    font: 'inherit',
                    color: 'var(--ink)',
                  }}
                >
                  {card.body}
                </pre>
              </div>
            );
          case 'POLICY_CHANGE':
          case 'AUTOMATION':
            return (
              <div className="card" key={i}>
                <div className="card-label">
                  {card.kind === 'POLICY_CHANGE' ? '정책 변경' : '자동화'}
                </div>
                <div className="card-row">{card.summary}</div>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function NextStep({ result }: { result: RouterResult }) {
  const s = result.nextStep;
  if (s.kind === 'NONE') return null;
  const label: Record<string, string> = {
    CLARIFY: '추가 확인 필요',
    START_OAUTH: `OAuth 시작 · ${'provider' in s ? s.provider : ''}`,
    NAVIGATE: `화면 이동 · ${'route' in s ? s.route : ''}`,
    DECIDE_APPROVAL: '결재 처리 대기',
    GATEWAY_CALL: `Tool Gateway 경유 · ${'capability' in s ? s.capability : ''}`,
    SAVE_APPROVAL_POLICY: '결재 정책 저장',
    SAVE_PREFERENCE: '보고 설정 저장',
    CREATE_AUTOMATION: '정기 업무 등록',
    PLAN_DELEGATED_WORK: '각 본부 업무 배분',
  };
  return <div className="nextstep">{label[s.kind] ?? s.kind}</div>;
}

export default function ChatClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setPending(true);
    setTurns((t) => [...t, { who: 'founder', text: message }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`요청이 실패했습니다 (${res.status})`);
      const result = (await res.json()) as RouterResult;
      setTurns((t) => [...t, { who: 'staff', result }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chat">
      <div className="thread">
        {turns.length === 0 && (
          <p className="hint">
            비서실장에게 말씀하십시오. 메뉴를 찾지 않으셔도 됩니다.
          </p>
        )}
        {turns.map((turn, i) =>
          turn.who === 'founder' ? (
            <div className="bubble founder" key={i}>
              {turn.text}
            </div>
          ) : (
            <div className="staff-turn" key={i}>
              <div className="bubble staff">{turn.result.reply}</div>
              <Cards result={turn.result} />
              <NextStep result={turn.result} />
            </div>
          ),
        )}
        {pending && <div className="hint">비서실장이 확인 중입니다…</div>}
        {error && <div className="hint error">{error}</div>}
      </div>

      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => void send(s)} disabled={pending}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const el = inputRef.current;
          if (!el) return;
          void send(el.value);
          el.value = '';
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="비서실장에게 지시하세요"
          aria-label="비서실장에게 보낼 메시지"
          maxLength={2000}
          disabled={pending}
        />
        <button type="submit" disabled={pending}>
          보내기
        </button>
      </form>
    </div>
  );
}
