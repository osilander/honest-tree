/**
 * Builds a standalone "reference tree" file for each sample dataset, so the
 * "bring your own reference tree" upload feature (Dropzone) has something
 * real to demonstrate against the shipped samples.
 *
 * There's no true/ground-truth tree available for these datasets to export
 * instead - the synthetic generator that made them was never checked in, and
 * the mammal set is real data with no known species tree - so this uses the
 * next best thing: a greedy consensus + averaged branch lengths built from
 * only a reproducible random HALF of each dataset's gene trees (not the
 * default, which uses all of them). That's still a real reconstruction, not
 * a canned answer, and it's genuinely independent of the full-dataset
 * consensus - different enough, especially at weakly-supported branches, to
 * show what evaluating the same gene trees against a *different* reference
 * looks like.
 *
 * Run with: npx tsx scripts/gen-reference-trees.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTreeFile } from '../src/parsing/newick';
import { buildTaxonIndex, tallyCladeFrequencies } from '../src/phylo/splits';
import { buildGreedyConsensus } from '../src/phylo/consensus';
import { assignAverageBranchLengths } from '../src/phylo/branchLengths';
import type { RawNode } from '../src/types';

function toNewick(node: RawNode): string {
  const lenStr = node.length !== null && node.length !== undefined && Number.isFinite(node.length) ? `:${node.length.toFixed(6)}` : '';
  if (node.children.length === 0) return `${node.name}${lenStr}`;
  return `(${node.children.map(toNewick).join(',')})${lenStr}`;
}

/** Deterministic, seeded Fisher-Yates shuffle so results are reproducible across runs. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIR = 'public/sample-data';

const DATASETS: { file: string; out: string; seed: number }[] = [
  { file: 'mammal-sample-all-cds.nwk', out: 'mammal-sample-all-cds-reference.nwk', seed: 1 },
  { file: 'synthetic_25taxa_500loci.nwk', out: 'synthetic_25taxa_500loci-reference.nwk', seed: 2 },
  { file: 'synthetic_25taxa_5000loci.nwk', out: 'synthetic_25taxa_5000loci-reference.nwk', seed: 3 },
  { file: 'synthetic_50taxa_500loci.nwk', out: 'synthetic_50taxa_500loci-reference.nwk', seed: 4 },
  { file: 'synthetic_50taxa_5000loci.nwk', out: 'synthetic_50taxa_5000loci-reference.nwk', seed: 5 },
];

const FRACTION = 0.5;

for (const d of DATASETS) {
  const text = readFileSync(`${DIR}/${d.file}`, 'utf-8');
  const { trees } = parseTreeFile(text);
  const index = buildTaxonIndex(trees);

  const subsetSize = Math.round(trees.length * FRACTION);
  const subset = seededShuffle(trees, d.seed).slice(0, subsetSize);

  const subsetFreq = tallyCladeFrequencies(subset, index);
  const subsetTree = buildGreedyConsensus(index, subsetFreq);
  assignAverageBranchLengths(subsetTree, subset, index);

  // For comparison only - how different is this from the full-dataset consensus?
  const fullFreq = tallyCladeFrequencies(trees, index);
  const fullTree = buildGreedyConsensus(index, fullFreq);
  const subsetSplits = new Set(splitKeys(subsetTree, index.taxa.length));
  const fullSplits = new Set(splitKeys(fullTree, index.taxa.length));
  const shared = [...subsetSplits].filter((k) => fullSplits.has(k)).length;

  writeFileSync(`${DIR}/${d.out}`, toNewick(subsetTree) + ';\n');
  console.log(
    `${d.file}: built from ${subset.length}/${trees.length} loci -> ${d.out} ` +
      `(${shared}/${subsetSplits.size} internal splits match the full-dataset consensus)`,
  );
}

/** Canonical (rooting-independent) split keys for topology comparison. */
function splitKeys(root: RawNode, numTaxa: number): string[] {
  const taxaOrder: string[] = [];
  (function collect(n: RawNode) {
    if (n.children.length === 0) taxaOrder.push(n.name);
    else n.children.forEach(collect);
  })(root);
  const indexOf = new Map(taxaOrder.map((t, i) => [t, i]));
  const full = (1n << BigInt(numTaxa)) - 1n;
  const keys: string[] = [];
  (function walk(n: RawNode): bigint {
    if (n.children.length === 0) return 1n << BigInt(indexOf.get(n.name)!);
    let mask = 0n;
    for (const c of n.children) mask |= walk(c);
    const pop = [...mask.toString(2)].filter((c) => c === '1').length;
    if (pop >= 2 && pop <= numTaxa - 2) {
      const canon = mask < (full ^ mask) ? mask : full ^ mask;
      keys.push(canon.toString(36));
    }
    return mask;
  })(root);
  return keys;
}
