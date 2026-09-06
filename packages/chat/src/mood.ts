/**
 * Is the founder telling us to do something, or asking about it?
 *
 * "인스타 연결해" and "인스타 계정 연결해야하는데 어떻게하면 되지?" both contain
 * 연결, so a rule that only looks for the verb answers a question by starting
 * the work — and then reports work it has not done. That is the worst failure
 * this product can have: the founder is meant to decide, and a system that acts
 * on a question has taken the decision away.
 *
 * So mood is read separately from intent. It only changes behaviour where an
 * action would otherwise begin; an information request is answered the same way
 * whichever mood it arrives in.
 */

export type Mood = 'QUESTION' | 'INSTRUCTION';

// Interrogatives and question endings. 되지/될까/할까 matter most: they turn an
// imperative verb into a question about it.
const QUESTION_MARKERS: readonly RegExp[] = [
  /\?/,
  /어떻게|어떡|어케/,
  /무엇|뭐(야|지|를|가|냐)|뭔가|뭘/,
  /언제|어디|누가|누구|왜|몇/,
  /되(지|나|나요|려면|는지)/,
  /(할|될|일)까/,
  /(습)?니까/,
  /나요|가요|런가|는가/,
  /가능(한|할)/,
  /방법|절차/,
  /맞(나|아|지)/,
  // Deliberation. "직원 뽑아야 하나", "메뉴판 새로 만들어야 될 것 같은데",
  // "가격 좀 올릴까 고민중이야" are the founder thinking aloud. Treating them as
  // orders opens a task for a decision they have not made.
  /야\s*(하|되)(나|나요|겠|지)/,
  /것\s*같은데|듯\s*한데|듯한데|고민(중|이|되)/,
  /\b(how|what|when|where|why|which|who|can i|should i|is it|are there)\b/i,
];

// An imperative ending wins over a stray marker: "연결해줘" is not a question
// because it contains 되 nowhere, but "알려줘" style requests are handled by the
// intent, not here.
const IMPERATIVE_TAIL = /(해|하라|해라|해줘|해주세요|시켜|시작해|보내|올려|바꿔|정리해|처리해)\s*[.!]*$/;

/**
 * "~ㄹ까" — the ending that turns a verb into wondering: 올릴까, 바꿀까, 할까.
 *
 * It cannot be written as a plain pattern over the verb stem, because Korean
 * composes the final ㄹ into the preceding syllable. So the final consonant is
 * read off the syllable itself, which also keeps 까먹다 and 까지 out.
 */
const RIEUL = 8;
function wonders(text: string): boolean {
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== '까') continue;
    const code = text.charCodeAt(i - 1) - 0xac00;
    if (code >= 0 && code < 11172 && code % 28 === RIEUL) return true;
  }
  return false;
}

export function readMood(utterance: string): Mood {
  const text = utterance.trim();
  if (text.length === 0) return 'INSTRUCTION';

  const asks = wonders(text) || QUESTION_MARKERS.some((re) => re.test(text));
  if (!asks) return 'INSTRUCTION';

  // "연결해줘?" is still an instruction typed with a stray mark; a real question
  // carries an interrogative word, not only punctuation.
  const onlyPunctuation =
    /\?/.test(text) && !QUESTION_MARKERS.slice(1).some((re) => re.test(text));
  if (onlyPunctuation && IMPERATIVE_TAIL.test(text.replace(/\?+\s*$/, ''))) {
    return 'INSTRUCTION';
  }

  return 'QUESTION';
}
