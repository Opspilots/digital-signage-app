import { minuteInRange } from '../routes/schedules';

describe('minuteInRange', () => {
  it('normal schedule (09:00-17:00)', () => {
    expect(minuteInRange(540, 480, 1020)).toBe(true);   // 9:00 in 8:00-17:00
    expect(minuteInRange(300, 480, 1020)).toBe(false);  // 5:00 not in 8:00-17:00
  });

  it('exact boundary — start is inclusive', () => {
    expect(minuteInRange(480, 480, 1020)).toBe(true);   // 8:00 == start => included
  });

  it('exact boundary — end is exclusive', () => {
    expect(minuteInRange(1020, 480, 1020)).toBe(false); // 17:00 == end => excluded
  });

  it('overnight schedule (23:00-02:00)', () => {
    expect(minuteInRange(1380, 1380, 120)).toBe(true);  // 23:00 in 23:00-02:00
    expect(minuteInRange(60, 1380, 120)).toBe(true);    // 01:00 in 23:00-02:00
    expect(minuteInRange(300, 1380, 120)).toBe(false);  // 05:00 not in 23:00-02:00
  });

  it('overnight — morning boundary (02:00) is exclusive', () => {
    expect(minuteInRange(120, 1380, 120)).toBe(false);  // 02:00 == end => excluded
  });
});
