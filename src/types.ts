// Core data model, following tree-browser-readme.md "Data Model" / "Internal State".

export type DominantConflict =
  | 'none'
  | 'low_conflict'
  | 'concentrated'
  | 'contradicted'
  | 'diffuse'
  | 'missing_data';

/**
 * One observed way this branch's clade appears across the gene tree set:
 * either cleanly monophyletic (isMain, extraTaxa empty) or nested inside a
 * clade that also contains `extraTaxa`. Replaces the old fixed
 * main/alt1/alt2/uninformative buckets - there are as many patterns as are
 * actually observed, ranked by frequency, with a long tail collapsed into a
 * single "other" entry.
 */
export interface TopologyPattern {
  key: string;
  isMain: boolean;
  isOther: boolean;
  extraTaxa: string[];
  count: number;
  /**
   * "(sideA) | (sideB)" nested-bracket notation for the reference vs. the
   * most-common-observed alternative shape, both restricted to the smallest
   * clade containing this branch's own taxa plus extraTaxa - shows *who's
   * actually paired with whom*, which a flat bipartition list can't. Absent
   * for `isMain`/`isOther` entries (main has nothing to contrast against;
   * other is a collapsed mix with no single representative shape).
   */
  refLocalSplit?: string;
  altLocalSplit?: string;
  /** Same trees as refLocalSplit/altLocalSplit, structured for rendering a small dendrogram instead of reading bracket text. */
  refLocalTree?: RawNode;
  altLocalTree?: RawNode;
  /** Which of the branch's own taxa are the actual movers in the representative altLocalTree (majority vote across loci sharing this pattern). */
  altMovers: string[];
}

export interface SupportMetrics {
  bootstrap?: number;
  posterior?: number;
  gcf?: number;
  scf?: number;
  /** Our own always-available metric: mainPattern.count / decisiveLoci. */
  concordantProportion: number;
}

export interface BranchCounts {
  totalLoci: number;
  decisiveLoci: number;
  missingLoci: number;
}

/**
 * How often a given taxon is implicated in this branch's problems: either as
 * one of the branch's own taxa that defected from its largest surviving
 * sub-clade in a non-reference topology (conflict - the actual "mover", not
 * just whichever foreign taxa it happened to land next to), or as the reason
 * a locus couldn't be tested at all (missing). A taxon that dominates one
 * branch's instability is often just "wandering" - a rogue placement,
 * paralog, or misassembly - rather than genuine phylogenetic signal.
 */
export interface TaxonInstabilityEntry {
  taxon: string;
  conflictCount: number;
  /** conflictCount / (decisiveLoci - mainCount), i.e. share of conflicting loci this taxon appears in. */
  conflictShare: number;
  missingCount: number;
  /** missingCount / totalLoci. */
  missingShare: number;
}

/**
 * One length reading behind a branch's averaged length estimate. `exact`
 * means the gene tree actually displayed this branch's precise clade;
 * otherwise the reading came from a coarser enclosing clade standing in for
 * it (common wherever the data is discordant), which is a meaningfully
 * different kind of evidence and shouldn't be visually conflated with a
 * genuine observation of this branch.
 */
export interface LengthObservation {
  length: number;
  exact: boolean;
}

export interface BranchRecord {
  branchId: string;
  splitId: string;
  taxaLeft: string[];
  taxaRight: string[];
  parentNodeId: string | null;
  childNodeId: string;
  support: SupportMetrics;
  counts: BranchCounts;
  dominantConflict: DominantConflict;
  /** Sorted by count desc; always includes a 'main' (isMain) entry, even at count 0. */
  topologyPatterns: TopologyPattern[];
  /** locus name -> topologyPatterns[].key, or 'missing'. */
  locusPatternKey: Record<string, string>;
  /** Sorted by (conflictShare + missingShare) desc, top entries only. */
  taxonInstability: TaxonInstabilityEntry[];
  /** The raw readings behind this branch's averaged length - see LengthObservation. */
  lengthObservations: LengthObservation[];
}

/**
 * Global (whole-tree) topology frequency ranking, independent of any single
 * branch: rank 1 is the single most common exact topology across all loci
 * ("the consensus" in the loosest sense - the plurality winner, not
 * necessarily identical to the compatible-splits reference tree), rank 2 the
 * next most common, etc. Ranks beyond `maxNamedRank` collapse into "other".
 */
export interface TopologyRankEntry {
  rank: number;
  count: number;
  isOther: boolean;
}

export interface TopologyRanking {
  /** locus name -> rank (1-based); ranks beyond maxNamedRank all report the same "other" rank number. */
  locusRank: Map<string, number>;
  ranks: TopologyRankEntry[];
  maxNamedRank: number;
}

export interface LocusMetadata {
  locusId: string;
  label: string;
  chromosome?: string;
  start?: number;
  end?: number;
  alignmentLength?: number;
  missingTaxa?: string[];
  gc?: number;
  partition?: string;
  treeFile?: string;
}

export type RenderMode =
  | 'support'
  | 'conflict'
  | 'evidence'
  | 'histogram'
  | 'barcode'
  | 'lens';

export type SupportMetricKey = 'gcf' | 'bootstrap' | 'posterior' | 'concordantProportion';

export interface AppState {
  selectedBranchId: string | null;
  hoveredBranchId: string | null;
  renderMode: RenderMode;
  supportMetric: SupportMetricKey;
  threshold: number;
  collapseWeakBranches: boolean;
  showTipLabels: boolean;
  useBranchLengths: boolean;
  showConcordanceSummary: boolean;
  matrixVisible: boolean;
  barcodeSort: 'input_order' | 'genomic_order' | 'gene_name' | 'state' | 'alignment_length' | 'missingness';
  tipLabelSize: number;
  branchWidthScale: number;
  showSupportValues: boolean;
  locusTrackMode: 'off' | 'chrom' | 'sorted';
  locusTrackMaxPoints: number | null;
  branchLocusTrackEnabled: boolean;
  taxonSampleMode: 'off' | 'random' | 'diverged';
  taxonSampleCount: number;
  taxonSampleSeed: number;
  rerootSplitId: string | null;
  searchTaxon: string | null;
  missingBreakdownOpen: boolean;
}

/** Raw parsed Newick node, before layout. */
export interface RawNode {
  name: string;
  length: number | null;
  children: RawNode[];
  /** Embedded support value read off an internal node label, if numeric. */
  supportLabel?: number;
}

export interface ParsedTree {
  name: string;
  root: RawNode;
}

/** A tree annotated with computed layout coordinates, ready to render. */
export interface LayoutNode {
  id: string;
  name: string;
  isLeaf: boolean;
  children: LayoutNode[];
  x: number;
  y: number;
  /** Present for internal nodes: canonical split id of the branch above this node. */
  splitId: string | null;
  branchId: string | null;
  /** Leaf mask (BigInt) of everything below this node - used for split computation. */
  mask: bigint;
}

export interface Dataset {
  taxa: string[];
  geneTrees: ParsedTree[];
  referenceTree: RawNode;
  branches: Map<string, BranchRecord>;
  /** branchId assigned in the reference tree's own preorder, stable across re-renders. */
  locusMetadata: Map<string, LocusMetadata>;
  warnings: string[];
  /** taxon name -> bit index, plus the full-universe bitmask; stable for this dataset. */
  taxonIndex: { taxa: string[]; indexOf: Map<string, number>; fullMask: bigint };
  topologyRanking: TopologyRanking;
}
