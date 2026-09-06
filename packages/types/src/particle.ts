/**
 * Korean particles that agree with the word before them — spec §128.
 *
 * 을/를, 은/는, 이/가, 와/과, 으로/로 are chosen by whether the preceding
 * syllable ends in a consonant. Writing one of them literally into a template
 * gets it wrong for half the words that can land there: the chat was saying
 * "오늘 매출를" and "네이버 플레이스는 발급한", which reads to a Korean founder
 * exactly the way "a apple" reads in English — the product sounding like it was
 * not written by anyone who speaks the language.
 *
 * The rule is mechanical, so it belongs in a function rather than in the
 * writer's memory.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;
/** ㄹ, the one final consonant that 으로/로 treats as if it were a vowel. */
const RIEUL = 8;

/**
 * The final consonant index of the last Hangul syllable, or null when the word
 * does not end in one — a Latin word, a digit, punctuation.
 */
function finalConsonant(word: string): number | null {
  const trimmed = word.trim();
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const code = trimmed.charCodeAt(i);
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      return (code - HANGUL_BASE) % JONGSEONG_COUNT;
    }
    // Anything else at the end (a bracket, a quote) is skipped; a Latin letter
    // or digit ends the search, because we cannot know how it is pronounced.
    if (/[A-Za-z0-9]/.test(trimmed[i]!)) return null;
  }
  return null;
}

/**
 * Pick the form that agrees with `word`.
 *
 * With no Hangul to judge by — "Instagram", "Gmail" — the vowel form is used.
 * It is the safer half: Korean writing attaches 를/는/가 to a foreign word read
 * with a vowel ending far more often than not.
 */
function agree(word: string, afterConsonant: string, afterVowel: string): string {
  const final = finalConsonant(word);
  return final !== null && final !== 0 ? afterConsonant : afterVowel;
}

/** 을/를 — object. */
export const eul = (word: string): string => agree(word, '을', '를');
/** 은/는 — topic. */
export const eun = (word: string): string => agree(word, '은', '는');
/** 이/가 — subject. */
export const i = (word: string): string => agree(word, '이', '가');
/** 와/과 — "and". */
export const wa = (word: string): string => agree(word, '과', '와');

/** 으로/로 — direction or means. ㄹ takes 로, alone among the consonants. */
export function euro(word: string): string {
  const final = finalConsonant(word);
  return final !== null && final !== 0 && final !== RIEUL ? '으로' : '로';
}

/** The word with its particle attached, which is how it is nearly always used. */
export const withEul = (word: string): string => `${word}${eul(word)}`;
export const withEun = (word: string): string => `${word}${eun(word)}`;
export const withI = (word: string): string => `${word}${i(word)}`;
