import { describe, expect, it } from 'vitest';
import { euro, eul, eun, i, wa, withEul } from '../src/particle';

describe('particles agree with the word before them', () => {
  it('picks 을 after a consonant and 를 after a vowel', () => {
    expect(eul('매출')).toBe('을'); // ㄹ
    expect(eul('광고비')).toBe('를');
    expect(eul('예약')).toBe('을');
    expect(eul('리뷰')).toBe('를');
    expect(eul('팔로워')).toBe('를');
    expect(withEul('오늘 매출')).toBe('오늘 매출을');
  });

  it('picks 은/는 and 이/가 the same way', () => {
    expect(eun('매출')).toBe('은');
    expect(eun('리뷰')).toBe('는');
    expect(i('예약')).toBe('이');
    expect(i('회사')).toBe('가');
    expect(wa('매출')).toBe('과');
    expect(wa('리뷰')).toBe('와');
  });

  it('treats ㄹ as a vowel for 으로, and nothing else', () => {
    expect(euro('메일')).toBe('로'); // ㄹ
    expect(euro('회사')).toBe('로'); // no final consonant
    expect(euro('보고서')).toBe('로');
    expect(euro('오늘')).toBe('로'); // ㄹ
    expect(euro('이번 달')).toBe('로'); // ㄹ
    expect(euro('반려')).toBe('로');
    expect(euro('승인')).toBe('으로'); // ㄴ
  });

  it('falls back to the vowel form for words with no Hangul', () => {
    // Instagram, Gmail — Korean writing attaches 를/는/가 to these far more
    // often than not, so the vowel form is the safer half of a guess.
    expect(eul('Instagram')).toBe('를');
    expect(eun('Gmail')).toBe('는');
    expect(i('CSV')).toBe('가');
  });

  it('ignores trailing punctuation when judging the ending', () => {
    expect(eul('매출)')).toBe('을');
    expect(eun('"리뷰"')).toBe('는');
  });
});
