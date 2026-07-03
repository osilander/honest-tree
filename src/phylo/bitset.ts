export function popcount(mask: bigint): number {
  let n = mask;
  let count = 0;
  while (n > 0n) {
    n &= n - 1n;
    count++;
  }
  return count;
}

export function isSubset(a: bigint, b: bigint): boolean {
  return (a & b) === a;
}

export function compareMasks(a: bigint, b: bigint): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
