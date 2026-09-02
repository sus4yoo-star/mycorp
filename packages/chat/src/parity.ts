/**
 * UI ↔ chat parity — spec §143.
 *
 * "모든 주요 UI Action은 대응되는 Conversation Action을 가진다."
 *
 * This registry makes that checkable instead of aspirational. Adding a route to
 * the product means adding it here with the phrase that reaches it, and the
 * parity test fails if the router cannot serve that phrase.
 */

export interface ParityEntry {
  readonly route: string;
  readonly uiAction: string;
  /** Utterances a founder would plausibly use for the same thing. */
  readonly utterances: readonly string[];
}

export const UI_CHAT_PARITY: readonly ParityEntry[] = [
  {
    route: '/approvals',
    uiAction: '결재 > 목록',
    utterances: ['결재할 거 있어?', '결재 뭐 남았어', '결재 대기 보여줘'],
  },
  {
    route: '/approvals',
    uiAction: '결재 > 승인',
    utterances: ['첫 번째 거 승인해', '두 번째 반려해'],
  },
  {
    route: '/connect',
    uiAction: '연결 > Gmail > Connect',
    utterances: ['Gmail 연결해', '인스타 연결해줘', '네이버 연동해'],
  },
  {
    route: '/hq',
    uiAction: '본사 > 직원 현황',
    utterances: ['직원들 뭐하고 있어?', '본사 화면 보여줘'],
  },
  {
    route: '/reports',
    uiAction: 'Reports > Monthly',
    utterances: ['지난달 보고서 보여줘', '보고서'],
  },
  {
    route: '/analytics/ads',
    uiAction: 'Analytics > Ads',
    utterances: ['광고 현황 화면 보여줘', '이번 달 광고비 얼마야?'],
  },
];
