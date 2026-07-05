import type { BranchRecord, DominantConflict, ParsedTree, RawNode, TaxonInstabilityEntry, TopologyPattern } from '../types';
import { annotateMasks, splitIdFor, taxaFromMask, type TaxonIndex } from './splits';
import { popcount } from './bitset';

const LOW_CONFLICT_MIN_CONCORDANCE = 0.7; // main-pattern share at/above this -> 'low_conflict'
const CONCENTRATED_MIN_SHARE = 0.5; // share of the non-main mass the top alternative needs to count as "concentrated"
const CONCENTRATED_MIN_LOCI = 3; // minimum loci behind an alternative before it counts as concentrated rather than noise
const MAX_NAMED_ALTERNATIVES = 9; // beyond this, the long tail collapses into one "other" entry

function buildParentMap(root: RawNode): Map<RawNode, RawNode | null> {
  const map = new Map<RawNode, RawNode | null>();
  (function walk(n: RawNode, parent: RawNode | null) {
    map.set(n, parent);
    for (const c of n.children) walk(c, n);
  })(root, null);
  return map;
}

function assignNodeIds(root: RawNode): Map<RawNode, string> {
  const ids = new Map<RawNode, string>();
  let counter = 0;
  (function walk(n: RawNode) {
    ids.set(n, `node_${counter++}`);
    n.children.forEach(walk);
  })(root);
  return ids;
}

/**
 * Divides a list of sibling subtrees into exactly two non-empty mask groups:
 * the largest subtree vs. the union of the rest. If only one subtree is given,
 * recurses into its own children until a real split is found or a leaf is hit
 * (returns null - unsplittable).
 */
function divideIntoTwoGroups(nodes: RawNode[], masks: Map<RawNode, bigint>): [bigint, bigint] | null {
  if (nodes.length === 0) return null;
  if (nodes.length === 1) {
    if (nodes[0].children.length === 0) return null;
    return divideIntoTwoGroups(nodes[0].children, masks);
  }
  const withMask = nodes.map((n) => ({ n, m: masks.get(n)! }));
  withMask.sort((a, b) => popcount(b.m) - popcount(a.m));
  const b1 = withMask[0].m;
  const b2 = withMask.slice(1).reduce((acc, x) => acc | x.m, 0n);
  return [b1, b2];
}

function collectOutsideEntries(parent: RawNode, cameFrom: RawNode, parentOf: Map<RawNode, RawNode | null>): RawNode[] {
  const entries: RawNode[] = [];
  let x: RawNode | null = parent;
  let prevChild: RawNode = cameFrom;
  while (x) {
    for (const child of x.children) {
      if (child !== prevChild) entries.push(child);
    }
    prevChild = x;
    x = parentOf.get(x) ?? null;
  }
  return entries;
}

/**
 * The branch's two "sibling" groups (the reference tree's own local division of
 * everything outside this branch's clade) - used only as a fallback to tell
 * apart alternatives that the general clade-based test can't distinguish (see
 * smallestEnclosingMask below).
 */
function siblingGroupsForBranch(
  parent: RawNode,
  child: RawNode,
  parentOf: Map<RawNode, RawNode | null>,
  masks: Map<RawNode, bigint>,
): [bigint, bigint] | null {
  const outsideEntries = collectOutsideEntries(parent, child, parentOf);
  return divideIntoTwoGroups(outsideEntries, masks);
}

interface GeneTreeIndexEntry {
  name: string;
  root: RawNode;
  geneMask: bigint;
  allMasks: bigint[];
  maskSet: Set<bigint>;
}

function indexGeneTrees(trees: ParsedTree[], index: TaxonIndex): GeneTreeIndexEntry[] {
  return trees.map((t) => {
    const masks = annotateMasks(t.root, index);
    const maskSet = new Set(masks.values());
    return { name: t.name, root: t.root, geneMask: masks.get(t.root)!, allMasks: [...maskSet], maskSet };
  });
}

/** Restricts a tree to only the leaves in `keep`, collapsing single-child chains left behind by pruned-out taxa. */
function pruneToMask(node: RawNode, index: TaxonIndex, keep: bigint): RawNode | null {
  if (node.children.length === 0) {
    const bit = index.indexOf.get(node.name);
    if (bit === undefined) return null;
    return (keep & (1n << BigInt(bit))) !== 0n ? node : null;
  }
  const kept = node.children.map((c) => pruneToMask(c, index, keep)).filter((c): c is RawNode => c !== null);
  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0];
  return { name: '', length: null, children: kept };
}

/** Plain nested bracket notation, e.g. "(Taxon 05,Taxon 06)". */
function localNewick(node: RawNode): string {
  return node.children.length === 0 ? node.name : `(${node.children.map(localNewick).join(',')})`;
}

/** Child-order-independent fingerprint, for grouping equivalent local shapes together regardless of file order. */
function localCanonicalKey(node: RawNode): string {
  if (node.children.length === 0) return node.name;
  return `(${node.children.map(localCanonicalKey).sort().join(',')})`;
}

/** "(sideA) | (sideB)" - the top-level division of a pruned local clade, smaller side first. */
function localSplitDisplay(node: RawNode): string {
  if (node.children.length !== 2) return localNewick(node);
  const [a, b] = node.children;
  const [smaller, larger] = countLeaves(a) <= countLeaves(b) ? [a, b] : [b, a];
  return `${localNewick(smaller)} | ${localNewick(larger)}`;
}

function countLeaves(node: RawNode): number {
  return node.children.length === 0 ? 1 : node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

/**
 * Finds the smallest node mask in this gene tree that fully contains `at`
 * (i.e. the smallest clade this gene tree places the branch's taxa within).
 * Always succeeds - the gene tree's own root mask is a trivial upper bound.
 */
function smallestEnclosingMask(entry: GeneTreeIndexEntry, at: bigint): bigint {
  let best = entry.geneMask;
  let bestPop = popcount(best);
  for (const m of entry.allMasks) {
    if ((m & at) === at) {
      const p = popcount(m);
      if (p < bestPop) {
        best = m;
        bestPop = p;
      }
    }
  }
  return best;
}

function lowestSetBit(mask: bigint): bigint {
  return mask & -mask;
}

/**
 * Identifies which of the branch's own taxa (`at`) actually defected in this
 * gene tree, as opposed to `extraTaxa` (foreign taxa that got pulled in),
 * which may be entirely innocent bystanders - a single taxon relocating next
 * to a large foreign clade produces a large `extraTaxa` set without that
 * clade's members having moved at all.
 *
 * For each taxon in `at`, its "contamination radius" is the size of the
 * smallest ancestor clade (in this gene tree) that also contains a taxon
 * outside `at` - i.e. how tightly that specific taxon is nested with
 * outsiders. A small radius means it associates closely with something
 * foreign (it moved); a large radius means it's only swept up in the
 * enclosing clade incidentally, at the outer boundary (it stayed put). The
 * taxa with the single *largest* radius are the branch's stable core for
 * this locus; everyone else is a mover. This also resolves the otherwise
 * degenerate case of a two-taxon branch, where "biggest pure subclade" ties
 * trivially between the two lone taxa and can't tell them apart.
 */
function movedTaxa(entry: GeneTreeIndexEntry, at: bigint): bigint {
  const foreign = entry.geneMask ^ at;
  const ownTaxa: bigint[] = [];
  for (let rest = at; rest !== 0n; ) {
    const bit = lowestSetBit(rest);
    ownTaxa.push(bit);
    rest ^= bit;
  }

  let bestRadius = -1;
  const radii = ownTaxa.map((t) => {
    let radius = Infinity;
    for (const m of entry.allMasks) {
      if ((m & t) !== 0n && (m & foreign) !== 0n) {
        const p = popcount(m);
        if (p < radius) radius = p;
      }
    }
    if (radius > bestRadius) bestRadius = radius;
    return radius;
  });

  let movers = 0n;
  ownTaxa.forEach((t, i) => {
    if (radii[i] !== bestRadius) movers |= t;
  });
  return movers;
}

interface PatternAccumulator {
  extraMask: bigint;
  count: number;
}

/**
 * Classifies one gene tree's relationship to a branch. Primary test: the
 * smallest clade containing the branch's taxa - if that's smaller than "the
 * whole gene tree", its extra taxa *are* the alternative (specific and local,
 * e.g. "groups with taxon X"). That primary test degenerates to "no answer"
 * exactly when the branch's clade is scattered with no intermediate grouping
 * at all - in that case fall back to asking which of the branch's two
 * reference-tree sibling groups it pairs with more cleanly, so a branch that
 * splits the tree roughly in half still gets two distinguishable alternatives
 * (matching what a fixed quartet test would have called "alt 1" / "alt 2")
 * instead of one catch-all "everything else" bucket.
 */
function classifyLocus(
  entry: GeneTreeIndexEntry,
  at: bigint,
  ownChildren: [bigint, bigint] | null,
  siblings: [bigint, bigint] | null,
): { key: string; extraMask: bigint } {
  const enclosing = smallestEnclosingMask(entry, at);
  const extra = enclosing ^ at;
  if (extra === 0n) return { key: 'main', extraMask: 0n };
  if (enclosing !== entry.geneMask) return { key: `alt_${extra.toString(36)}`, extraMask: extra };

  // Degenerate case: no intermediate clade found because the branch's own
  // taxa are scattered rather than nested together. Test whether just one of
  // the branch's own two children pairs cleanly with one of its siblings -
  // the same test a fixed quartet would run, used here only as a fallback.
  if (ownChildren && siblings) {
    for (const a of ownChildren) {
      const aT = a & entry.geneMask;
      if (aT === 0n) continue;
      for (const sib of siblings) {
        const sibT = sib & entry.geneMask;
        if (sibT !== 0n && entry.maskSet.has(aT | sibT)) {
          return { key: `alt_side_${sib.toString(36)}`, extraMask: sibT };
        }
      }
    }
  }
  // No intermediate clade, and no clean pairing with either sibling group
  // either - this locus's placement of the branch's taxa doesn't match the
  // reference and doesn't point at any identifiable rival grouping. That's
  // genuinely uninformative for this branch, not a specific alternative
  // topology, and must not be reported as one.
  return { key: 'uninformative', extraMask: extra };
}

function dominantConflictFor(decisiveLoci: number, mainCount: number, topAltCount: number): DominantConflict {
  if (decisiveLoci === 0) return 'missing_data';
  const mainShare = mainCount / decisiveLoci;
  if (mainShare >= LOW_CONFLICT_MIN_CONCORDANCE) return 'low_conflict';
  if (topAltCount > mainCount) return 'contradicted';
  const nonMain = decisiveLoci - mainCount;
  if (nonMain > 0 && topAltCount >= CONCENTRATED_MIN_LOCI && topAltCount / nonMain >= CONCENTRATED_MIN_SHARE) {
    return 'concentrated';
  }
  return 'diffuse';
}

export function computeBranchRecords(
  referenceRoot: RawNode,
  geneTrees: ParsedTree[],
  index: TaxonIndex,
): Map<string, BranchRecord> {
  const refMasks = annotateMasks(referenceRoot, index);
  const parentOf = buildParentMap(referenceRoot);
  const nodeIds = assignNodeIds(referenceRoot);
  const geneIndex = indexGeneTrees(geneTrees, index);
  const totalLoci = geneTrees.length;

  const branches = new Map<string, BranchRecord>();
  let branchCounter = 0;

  (function walk(node: RawNode) {
    const parent = parentOf.get(node) ?? null;
    if (parent && node.children.length > 0) {
      const mask = refMasks.get(node)!;
      const complement = index.fullMask ^ mask;
      if (popcount(mask) >= 2 && popcount(complement) >= 2) {
        branchCounter++;
        const splitId = splitIdFor(mask, index.fullMask);
        const siblings = siblingGroupsForBranch(parent, node, parentOf, refMasks);
        const ownChildren = divideIntoTwoGroups(node.children, refMasks);

        let missingLoci = 0;
        let uninformativeLoci = 0;
        const patterns = new Map<string, PatternAccumulator>();
        const locusPatternKey: Record<string, string> = {};
        const taxonConflict = new Map<string, number>();
        const taxonMissing = new Map<string, number>();
        // patternKey -> canonical local shape -> how often that exact shape occurred, plus one example to render
        const localShapeTally = new Map<string, Map<string, { count: number; example: RawNode; scope: bigint }>>();
        // patternKey -> own taxon -> how many of that pattern's loci identified it as the mover
        const moverTallyByKey = new Map<string, Map<string, number>>();

        for (const entry of geneIndex) {
          const T = entry.geneMask;
          const at = mask & T;
          const otherSideInT = T & complement;
          if (popcount(at) < 2 || otherSideInT === 0n) {
            missingLoci++;
            locusPatternKey[entry.name] = 'missing';
            const missingBits = mask & (index.fullMask ^ T);
            for (const taxon of taxaFromMask(missingBits, index)) {
              taxonMissing.set(taxon, (taxonMissing.get(taxon) ?? 0) + 1);
            }
            continue;
          }

          const { key, extraMask } = classifyLocus(entry, at, ownChildren, siblings);

          if (key === 'uninformative') {
            uninformativeLoci++;
            locusPatternKey[entry.name] = 'uninformative';
            continue;
          }

          locusPatternKey[entry.name] = key;

          const acc = patterns.get(key);
          if (acc) acc.count++;
          else patterns.set(key, { extraMask, count: 1 });

          if (key !== 'main') {
            const movers = movedTaxa(entry, at);
            const moverTaxa = taxaFromMask(movers, index);
            for (const taxon of moverTaxa) {
              taxonConflict.set(taxon, (taxonConflict.get(taxon) ?? 0) + 1);
            }
            let moverCounts = moverTallyByKey.get(key);
            if (!moverCounts) {
              moverCounts = new Map();
              moverTallyByKey.set(key, moverCounts);
            }
            for (const taxon of moverTaxa) {
              moverCounts.set(taxon, (moverCounts.get(taxon) ?? 0) + 1);
            }

            const scope = at | extraMask;
            const pruned = pruneToMask(entry.root, index, scope);
            if (pruned) {
              const canon = localCanonicalKey(pruned);
              let byCanon = localShapeTally.get(key);
              if (!byCanon) {
                byCanon = new Map();
                localShapeTally.set(key, byCanon);
              }
              const rec = byCanon.get(canon);
              if (rec) rec.count++;
              else byCanon.set(canon, { count: 1, example: pruned, scope });
            }
          }
        }

        const decisiveLoci = totalLoci - missingLoci - uninformativeLoci;
        const mainAcc = patterns.get('main');
        const mainCount = mainAcc?.count ?? 0;
        const conflictingLociTotal = decisiveLoci - mainCount;

        const instabilityTaxa = new Set([...taxonConflict.keys(), ...taxonMissing.keys()]);
        const taxonInstability: TaxonInstabilityEntry[] = [...instabilityTaxa]
          .map((taxon) => {
            const conflictCount = taxonConflict.get(taxon) ?? 0;
            const missingCount = taxonMissing.get(taxon) ?? 0;
            return {
              taxon,
              conflictCount,
              conflictShare: conflictingLociTotal > 0 ? conflictCount / conflictingLociTotal : 0,
              missingCount,
              missingShare: totalLoci > 0 ? missingCount / totalLoci : 0,
            };
          })
          .sort((a, b) => b.conflictShare + b.missingShare - (a.conflictShare + a.missingShare))
          .slice(0, 8);

        const altEntries = [...patterns.entries()]
          .filter(([key]) => key !== 'main')
          .sort((a, b) => b[1].count - a[1].count);

        const namedAlts = altEntries.slice(0, MAX_NAMED_ALTERNATIVES);
        const tailAlts = altEntries.slice(MAX_NAMED_ALTERNATIVES);
        const otherCount = tailAlts.reduce((acc, [, v]) => acc + v.count, 0);

        const topologyPatterns: TopologyPattern[] = [
          { key: 'main', isMain: true, isOther: false, extraTaxa: [], count: mainCount, altMovers: [] },
          ...namedAlts.map(([key, v]) => {
            const shapes = localShapeTally.get(key);
            const winner = shapes ? [...shapes.values()].sort((a, b) => b.count - a.count)[0] : null;
            const refLocal = winner ? pruneToMask(referenceRoot, index, winner.scope) : null;
            const moverCounts = moverTallyByKey.get(key);
            const altMovers = moverCounts
              ? [...moverCounts.entries()].filter(([, c]) => c / v.count >= 0.5).map(([taxon]) => taxon)
              : [];
            return {
              key,
              isMain: false,
              isOther: false,
              extraTaxa: taxaFromMask(v.extraMask, index),
              count: v.count,
              refLocalSplit: refLocal ? localSplitDisplay(refLocal) : undefined,
              altLocalSplit: winner ? localSplitDisplay(winner.example) : undefined,
              refLocalTree: refLocal ?? undefined,
              altLocalTree: winner ? winner.example : undefined,
              altMovers,
            };
          }),
        ];
        if (otherCount > 0) {
          topologyPatterns.push({ key: 'other', isMain: false, isOther: true, extraTaxa: [], count: otherCount, altMovers: [] });
        }

        // Exclude isOther - it's a collapsed tail of many small alternatives, not
        // one specific topology, so it can outweigh every real alternative just by
        // being their sum without representing any single coherent disagreement
        // (which would wrongly read as "concentrated" instead of "diffuse").
        const topAltCount = Math.max(0, ...topologyPatterns.filter((p) => !p.isMain && !p.isOther).map((p) => p.count));
        const concordantProportion = decisiveLoci > 0 ? mainCount / decisiveLoci : 0;

        const record: BranchRecord = {
          branchId: `branch_${branchCounter}`,
          splitId,
          taxaLeft: taxaFromMask(mask, index),
          taxaRight: taxaFromMask(complement, index),
          parentNodeId: nodeIds.get(parent) ?? null,
          childNodeId: nodeIds.get(node)!,
          support: {
            concordantProportion,
            gcf: concordantProportion * 100,
          },
          counts: { totalLoci, decisiveLoci, missingLoci, uninformativeLoci },
          dominantConflict: dominantConflictFor(decisiveLoci, mainCount, topAltCount),
          topologyPatterns,
          locusPatternKey,
          taxonInstability,
          lengthObservations: [],
        };
        branches.set(splitId, record);
      }
    }
    node.children.forEach(walk);
  })(referenceRoot);

  return branches;
}
