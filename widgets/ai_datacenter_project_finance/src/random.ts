/** PCG XSH RR 64/32, matching the official minimal C implementation.
 * https://www.pcg-random.org/download.html#minimal-c-implementation
 * Explicit unsigned truncation preserves C's modulo-2^64 and modulo-2^32 arithmetic.
 */
export class Pcg32 {
  private state = 0n;
  private increment: bigint;
  constructor(seed: bigint, sequence: bigint) {
    this.increment = BigInt.asUintN(64, (sequence << 1n) | 1n);
    this.nextUint32();
    this.state = BigInt.asUintN(64, this.state + seed);
    this.nextUint32();
  }
  nextUint32(): number {
    const old = this.state;
    this.state = BigInt.asUintN(64, old * 6364136223846793005n + this.increment);
    const shifted = Number(BigInt.asUintN(32, ((old >> 18n) ^ old) >> 27n));
    const rotation = Number(old >> 59n);
    return ((shifted >>> rotation) | (shifted << ((-rotation) & 31))) >>> 0;
  }
  uniform(): number { return this.nextUint32() / 4294967296; }
  /** Rejection avoids modulo bias when sampling whole months. */
  integer(bound: number): number {
    const threshold = 4294967296 % bound;
    let value: number;
    do { value = this.nextUint32(); } while (value < threshold);
    return value % bound;
  }
}
