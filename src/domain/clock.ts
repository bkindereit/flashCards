/**
 * Injectable Clock and Seeded Random Interfaces
 * Implements ARC-010, TST-006, TST-007
 */

export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements IClock {
  private currentTime: Date;

  constructor(time: Date | string | number) {
    this.currentTime = new Date(time);
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  setTime(time: Date | string | number): void {
    this.currentTime = new Date(time);
  }
}

export interface IRandom {
  next(): number; // [0, 1)
  getSeed(): string;
}

export class SystemRandom implements IRandom {
  next(): number {
    return Math.random();
  }
  getSeed(): string {
    return 'system';
  }
}

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
export class SeededRandom implements IRandom {
  private state: number;
  private readonly initialSeed: string;

  constructor(seed: string | number) {
    this.initialSeed = String(seed);
    let h = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    this.state = h;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getSeed(): string {
    return this.initialSeed;
  }
}
