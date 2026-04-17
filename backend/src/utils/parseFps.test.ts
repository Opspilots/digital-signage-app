import { parseFps } from '../routes/media';

describe('parseFps', () => {
  it('parses integer fps (30/1)', () => {
    expect(parseFps('30/1')).toBe(30);
  });

  it('parses fractional fps (24000/1001)', () => {
    expect(parseFps('24000/1001')).toBeCloseTo(23.976, 2);
  });

  it('parses whole-number string without denominator', () => {
    expect(parseFps('25')).toBe(25);
  });

  it('returns null for empty string', () => {
    expect(parseFps('')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseFps('abc')).toBeNull();
  });
});
