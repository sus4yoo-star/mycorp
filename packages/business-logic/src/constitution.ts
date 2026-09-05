/**
 * What the company has decided it does not do — spec §139.
 *
 * The founder's own words are the rule. This lives here rather than beside the
 * proposal agent because a decision binds everything the company writes: a
 * proposal about a competitor and a draft reply to a customer are equally
 * capable of offering the discount the founder banned, and there should be one
 * answer to "does this break a company decision", not two that drift.
 *
 * It is a backstop, not the control. The control is that nothing written here
 * can act — a person reads it and decides. A wrongly blocked draft is visible
 * to the founder, so the failure is legible rather than silent.
 */

/**
 * Pull the thing being forbidden out of a founder's sentence.
 *
 *   "우리 브랜드는 절대 가격할인 하지마"  -> 가격할인
 *   "쿠폰 발행 금지"                      -> 쿠폰, 발행
 *   "Never run discount campaigns"        -> discount, campaigns
 *
 * Everything before the negation is a candidate, because a ban is usually a
 * phrase rather than a single noun: taking only the word nearest the negation
 * would let "쿠폰 이벤트" through a ban on "쿠폰 발행".
 *
 * Words too common to be a ban are dropped. "경쟁사 비방 금지" forbids
 * disparaging competitors, not mentioning them — and every competitor-move
 * proposal mentions 경쟁사, so keeping it would block the whole feature.
 *
 * This is a backstop, not the control. The control is that a proposal cannot
 * do anything: a human reads it and decides. A wrongly blocked proposal is
 * visible in `rejected`, so the failure mode is legible rather than silent.
 */
export function forbiddenTerms(rule: string): string[] {
  const negation =
    /(하지\s*마|하지\s*않|금지|안\s*한다|말\s*것|\bno\b|\bnever\b|don't|do not)/i.exec(rule);
  if (!negation) return [];

  // Only the clause the negation applies to.
  const clause = rule.slice(0, negation.index);
  const terms = new Set<string>();

  collect(clause, terms);

  // "Never run discount campaigns" puts the object after the negation.
  if (terms.size === 0) {
    collect(rule.slice(negation.index + negation[0].length), terms);
  }

  return [...terms];
}

function collect(fragment: string, into: Set<string>): void {
  for (const m of fragment.matchAll(/[가-힣]{2,10}/g)) {
    const t = m[0]!;
    if (!STOPWORDS.has(t) && !TOO_COMMON.has(t)) into.add(t.toLowerCase());
  }
  for (const m of fragment.matchAll(/[a-z]{4,}/gi)) {
    const t = m[0]!.toLowerCase();
    if (!EN_STOPWORDS.has(t) && !TOO_COMMON.has(t)) into.add(t);
  }
}

/**
 * Words that appear in almost every business proposal. Treating one of these as
 * a banned term would block the feature rather than a decision — a ban on
 * "경쟁사 비방" is about 비방, not about ever saying 경쟁사.
 */
const TOO_COMMON = new Set([
  '경쟁사', '고객', '회사', '매출', '가격', '광고', '마케팅', '서비스', '제품',
  '브랜드', '사업', '운영', '직원', '시장', '채널', '콘텐츠', '캠페인',
  'customer', 'company', 'revenue', 'price', 'brand', 'market', 'service',
  'product', 'content', 'channel', 'business',
]);

const STOPWORDS = new Set([
  '우리', '브랜드', '회사', '절대', '항상', '무조건', '경우', '이것', '그것',
  '앞으로', '앞의', '다음', '모든', '어떤',
]);
const EN_STOPWORDS = new Set([
  'never', 'always', 'must', 'should', 'this', 'that', 'with', 'from',
  'they', 'them', 'dont', 'ever', 'under', 'circumstances',
]);

/**
 * The decision this text breaks, or null.
 *
 * Returns the rule itself rather than a boolean so the founder can be told
 * which of their own instructions stopped it — "차단됨" teaches nobody anything.
 */
export function breaksDecision(
  text: string,
  decisions: readonly string[],
): string | null {
  const haystack = text.toLowerCase();
  for (const rule of decisions) {
    const terms = forbiddenTerms(rule);
    if (terms.length > 0 && terms.some((t) => haystack.includes(t))) return rule;
  }
  return null;
}
