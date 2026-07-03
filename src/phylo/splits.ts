import type { ParsedTree, RawNode } from '../types';
import { popcount } from './bitset';

export interface TaxonIndex {
  taxa: string[];
  indexOf: Map<string, number>;
  fullMask: bigint;
}

/** Builds the taxon superset across all input trees, in first-appearance order. */
export function buildTaxonIndex(trees: ParsedTree[]): TaxonIndex {
  const taxa: string[] = [];
  const indexOf = new Map<string, number>();
  for (const t of trees) {
    (function walk(n: RawNode) {
      if (n.children.length === 0) {
        if (!indexOf.has(n.name)) {
          indexOf.set(n.name, taxa.length);
          taxa.push(n.name);
        }
      } else {
        n.children.forEach(walk);
      }
    })(t.root);
  }
  let fullMask = 0n;
  for (let i = 0; i < taxa.length; i++) fullMask |= 1n << BigInt(i);
  return { taxa, indexOf, fullMask };
}

/** Computes and returns the leaf-set bitmask for every node in `root`, keyed by node identity. */
export function annotateMasks(root: RawNode, index: TaxonIndex): Map<RawNode, bigint> {
  const masks = new Map<RawNode, bigint>();
  (function walk(n: RawNode): bigint {
    let mask: bigint;
    if (n.children.length === 0) {
      const bit = index.indexOf.get(n.name);
      if (bit === undefined) {
        throw new Error(`Taxon "${n.name}" not present in taxon index`);
      }
      mask = 1n << BigInt(bit);
    } else {
      mask = 0n;
      for (const c of n.children) mask |= walk(c);
    }
    masks.set(n, mask);
    return mask;
  })(root);
  return masks;
}

/** Per-taxon missing-taxa report, relative to the global taxon superset. */
export function taxonCoverageWarnings(trees: ParsedTree[], index: TaxonIndex): string[] {
  const warnings: string[] = [];
  for (const t of trees) {
    const present = new Set<string>();
    (function walk(n: RawNode) {
      if (n.children.length === 0) present.add(n.name);
      else n.children.forEach(walk);
    })(t.root);
    const missing = index.taxa.filter((name) => !present.has(name));
    if (missing.length > 0) {
      warnings.push(`${t.name}: missing ${missing.length} taxon/taxa (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''})`);
    }
  }
  return warnings;
}

/**
 * Tallies every non-trivial clade (internal-node leaf-set) observed across the gene
 * tree set, keyed by its global bitmask. A clade counts once per gene tree that
 * displays it exactly, regardless of that tree's own taxon sampling - this is what
 * lets trees with missing taxa still contribute to consensus building.
 */
export function tallyCladeFrequencies(trees: ParsedTree[], index: TaxonIndex): Map<bigint, number> {
  const freq = new Map<bigint, number>();
  for (const t of trees) {
    const masks = annotateMasks(t.root, index);
    const seenInThisTree = new Set<bigint>();
    for (const mask of masks.values()) {
      if (popcount(mask) < 2) continue; // trivial (leaf) clade
      if (seenInThisTree.has(mask)) continue; // shouldn't normally recur, but guard anyway
      seenInThisTree.add(mask);
      freq.set(mask, (freq.get(mask) ?? 0) + 1);
    }
  }
  return freq;
}

/** Canonical, rooting-independent identifier for a full-taxon-set bipartition. */
export function splitIdFor(mask: bigint, fullMask: bigint): string {
  const complement = fullMask ^ mask;
  const canon = mask < complement ? mask : complement;
  return `split_${canon.toString(36)}`;
}

export function taxaFromMask(mask: bigint, index: TaxonIndex): string[] {
  const out: string[] = [];
  for (let i = 0; i < index.taxa.length; i++) {
    if ((mask & (1n << BigInt(i))) !== 0n) out.push(index.taxa[i]);
  }
  return out;
}
