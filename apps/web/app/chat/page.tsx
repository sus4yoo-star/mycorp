import ChatClient from './ChatClient';

/**
 * Chief of staff chat — spec §76, §77, §143.
 *
 * Every major UI action has a conversational equivalent. The suggestions below
 * are drawn from the parity registry in `@mycorp24/chat`, which is enforced by
 * test: if a route stops being reachable by chat, the parity test fails.
 */
export default function ChatPage() {
  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>비서실</h1>
      <p className="rule-line" style={{ margin: '0 0 1.5rem' }}>
        AI prepares. &nbsp;Founder approves. &nbsp;Company executes.
      </p>
      <ChatClient />
      <p style={{ marginTop: '1.5rem', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
        연결·결재 데이터는 아직 데모 값입니다. 비서실장은 연결되지 않은 기능을
        했다고 말하지 않습니다.
      </p>
    </main>
  );
}
