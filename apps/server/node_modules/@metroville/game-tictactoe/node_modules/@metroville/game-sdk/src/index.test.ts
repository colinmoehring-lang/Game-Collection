import { describe, it, expect } from 'vitest';
import { createRNG, shuffleArray } from './index.js';

describe('Game SDK Utilities', () => {
  it('creates deterministic random numbers with same seed', () => {
    const rng1 = createRNG('metro-seed');
    const rng2 = createRNG('metro-seed');

    const vals1 = [rng1(), rng1(), rng1()];
    const vals2 = [rng2(), rng2(), rng2()];

    expect(vals1).toEqual(vals2);
    expect(vals1[0]).toBeGreaterThanOrEqual(0);
    expect(vals1[0]).toBeLessThan(1);
  });

  it('shuffles arrays deterministically with seeded RNG', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s1 = shuffleArray(arr, createRNG('test-seed-a'));
    const s2 = shuffleArray(arr, createRNG('test-seed-a'));

    expect(s1).toEqual(s2);
    expect(s1.length).toBe(arr.length);
  });
});
