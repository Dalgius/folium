import { describe, expect, it } from 'vitest';
import { parseAmount, parseDecimal } from './forms';

describe('parseAmount', () => {
  it('negli importi il punto separa le migliaia', () => {
    expect(parseAmount('1.800')).toBe(1800);
    expect(parseAmount('12.500')).toBe(12500);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('1.800,50')).toBe(1800.5);
    expect(parseAmount('60,50')).toBe(60.5);
    expect(parseAmount('60.5')).toBe(60.5);
    expect(parseAmount('-1.200')).toBe(-1200);
  });

  it('parseDecimal resta invariato per prezzi e quantità', () => {
    expect(parseDecimal('6.237')).toBe(6.237);
  });
});
