/**
 * Korean particle agreement lives in @mycorp24/types, the one package every
 * other package already depends on — integrations needs it too, and making
 * integrations depend on business-logic would close a cycle.
 *
 * Re-exported here so the callers that think of it as language, not types,
 * keep importing it from where they expect.
 */
export { euro, eul, eun, i, wa, withEul, withEun, withI } from '@mycorp24/types';
