/**
 * Rebuilds the mammal CDS sample dataset from the original source data
 * (Chen, Liang & Zhang 2017, downloaded from the paper's data archive),
 * replacing the earlier ad hoc mammal files with something traceable and
 * consistent:
 *
 *  - a full set and a reproducible ~1000-gene sample of the 10,259 CDS gene
 *    trees, as a NEXUS file with real per-gene tree names (ENSG id + gene
 *    symbol) instead of the anonymous "locus_N" names a plain multi-tree
 *    Newick file would get - the point of this was raised directly by the
 *    user asking whether trees can be "named" for locus-metadata matching;
 *  - the paper's own real ASTRAL species tree (already using the same
 *    simple genus-level taxon names as the gene trees, no translation
 *    needed) as the reference tree, replacing the earlier ad hoc
 *    half-subsample-average reconstruction;
 *  - a per-locus metadata TSV covering all 10,259 genes: alignment length,
 *    overall GC%, variable/parsimony-informative site counts (computed
 *    directly from the alignments here), plus the paper's own GC/rate/
 *    resolution/completeness subset bucket membership (from its published
 *    gene-list files, not recomputed).
 *
 * Run with: npx tsx scripts/rebuild-mammal-dataset.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIR = '/Users/osilande/Downloads/5259829/CDS_without_pangolin';
const GENE_TREES_DIR = join(SOURCE_DIR, 'genetrees of CDS');
const ALIGN_DIR = join(SOURCE_DIR, 'CDS_refined_gene');
const RESULTS_DIR = join(SOURCE_DIR, 'results');
const OUT_DIR = 'testdata';

const NAME_SUFFIX = '_rhinoceros_added_2N';

interface Gene {
  rawKey: string; // e.g. ENSG00000000003_TSPAN6_rhinoceros_added_2N - matches source filenames
  locus: string; // e.g. ENSG00000000003_TSPAN6 - clean name used in the app
  ensgId: string;
  symbol: string;
  newick: string;
}

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

function readOrderlistLoci(filename: string): Set<string> {
  const text = readFileSync(join(SOURCE_DIR, filename), 'utf-8');
  const set = new Set<string>();
  for (const line of text.split('\n')) {
    const first = line.split('\t')[0]?.trim();
    if (first) set.add(first.replace(/\.fasta$/, ''));
  }
  return set;
}

function bucketFor(rawKey: string, buckets: [Set<string>, string][]): string {
  // buckets ordered strictest-first; first (smallest/strictest) match wins
  for (const [set, label] of buckets) {
    if (set.has(rawKey)) return label;
  }
  return '';
}

function parseFasta(text: string): string[] {
  const rows: string[] = [];
  let chunks: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('>')) {
      if (chunks.length > 0) rows.push(chunks.join(''));
      chunks = [];
    } else if (line) {
      chunks.push(line);
    }
  }
  if (chunks.length > 0) rows.push(chunks.join(''));
  return rows;
}

function computeAlignmentStats(rows: string[]) {
  const length = rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0;
  let gcCount = 0;
  let atgcCount = 0;
  let variableSites = 0;
  let piSites = 0;
  for (let col = 0; col < length; col++) {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const ch = (row[col] ?? '-').toUpperCase();
      if (ch === 'A' || ch === 'C' || ch === 'G' || ch === 'T') {
        counts[ch] = (counts[ch] ?? 0) + 1;
        atgcCount++;
        if (ch === 'C' || ch === 'G') gcCount++;
      }
    }
    const distinct = Object.keys(counts);
    if (distinct.length >= 2) {
      variableSites++;
      if (distinct.filter((b) => counts[b] >= 2).length >= 2) piSites++;
    }
  }
  return {
    alignmentLength: length,
    gcPercent: atgcCount > 0 ? (gcCount / atgcCount) * 100 : NaN,
    variableSites,
    piSites,
    pctInformative: length > 0 ? (piSites / length) * 100 : NaN,
  };
}

console.log('Reading gene tree files...');
const treeFiles = readdirSync(GENE_TREES_DIR).filter((f) => f.startsWith('RAxML_bipartitions.') && f.endsWith('.out'));
console.log(`Found ${treeFiles.length} gene tree files`);

const genes: Gene[] = [];
for (const f of treeFiles) {
  const rawKey = f.replace(/^RAxML_bipartitions\./, '').replace(/\.out$/, '');
  const locus = rawKey.endsWith(NAME_SUFFIX) ? rawKey.slice(0, -NAME_SUFFIX.length) : rawKey;
  const m = locus.match(/^(ENSG\d+)_(.+)$/);
  if (!m) {
    console.warn(`Skipping unparseable filename: ${f}`);
    continue;
  }
  const newick = readFileSync(join(GENE_TREES_DIR, f), 'utf-8').trim();
  genes.push({ rawKey, locus, ensgId: m[1], symbol: m[2], newick });
}
console.log(`Parsed ${genes.length} genes`);

console.log('Loading subset membership lists...');
const gc1 = readOrderlistLoci('Laurasiatheria_cds_GC1_genelist_Nuc_orderlist.txt');
const gc2 = readOrderlistLoci('Laurasiatheria_cds_GC2_genelist_Nuc_orderlist.txt');
const gc3 = readOrderlistLoci('Laurasiatheria_cds_GC3_genelist_Nuc_orderlist.txt');
const res70 = readOrderlistLoci('Laurasiatheria_cds_0.7resolution_genelist_Nuc_orderlist.txt');
const res80 = readOrderlistLoci('Laurasiatheria_cds_0.8resolution_genelist_Nuc_orderlist.txt');
const res90 = readOrderlistLoci('Laurasiatheria_cds_0.9resolution_genelist_Nuc_orderlist.txt');
const slow = readOrderlistLoci('Laurasiatheria_cds_slow_rate_genelist_Nuc_orderlist.txt');
const fast = readOrderlistLoci('Laurasiatheria_cds_fast_rate_genelist_Nuc_orderlist.txt');
const comp70 = readOrderlistLoci('Laurasiatheria_cds_0.7comp_genelist_Nuc_orderlist.txt');
const comp80 = readOrderlistLoci('Laurasiatheria_cds_0.8comp_genelist_Nuc_orderlist.txt');
const comp90 = readOrderlistLoci('Laurasiatheria_cds_0.9comp_genelist_Nuc_orderlist.txt');

console.log('Computing alignment stats (this is the slow part)...');
const metadataRows: string[] = [];
metadataRows.push(
  [
    'locus',
    'ensg_id',
    'gene_symbol',
    'alignment_length',
    'gc_percent',
    'variable_sites',
    'parsimony_informative_sites',
    'pct_informative_sites',
    'gc3_bucket', // paper's own GC3% (3rd-codon-position) threshold bucket - NOT the same metric as gc_percent above, which is overall GC computed here
    'resolution_bucket',
    'rate_bucket',
    'completeness_bucket',
  ].join('\t'),
);

let processed = 0;
for (const g of genes) {
  const fastaPath = join(ALIGN_DIR, `${g.rawKey}.fasta`);
  let stats;
  try {
    const text = readFileSync(fastaPath, 'utf-8');
    stats = computeAlignmentStats(parseFasta(text));
  } catch {
    stats = { alignmentLength: NaN, gcPercent: NaN, variableSites: NaN, piSites: NaN, pctInformative: NaN };
  }

  const gcBucket = bucketFor(g.rawKey, [
    [gc3, 'GC3'],
    [gc2, 'GC2'],
    [gc1, 'GC1'],
  ]);
  const resolutionBucket = bucketFor(g.rawKey, [
    [res90, '90'],
    [res80, '80'],
    [res70, '70'],
  ]);
  const rateBucket = bucketFor(g.rawKey, [
    [slow, 'slow'],
    [fast, 'fast'],
  ]);
  const completenessBucket = bucketFor(g.rawKey, [
    [comp90, '90'],
    [comp80, '80'],
    [comp70, '70'],
  ]);

  metadataRows.push(
    [
      g.locus,
      g.ensgId,
      g.symbol,
      Number.isFinite(stats.alignmentLength) ? stats.alignmentLength : '',
      Number.isFinite(stats.gcPercent) ? stats.gcPercent.toFixed(2) : '',
      Number.isFinite(stats.variableSites) ? stats.variableSites : '',
      Number.isFinite(stats.piSites) ? stats.piSites : '',
      Number.isFinite(stats.pctInformative) ? stats.pctInformative.toFixed(2) : '',
      gcBucket,
      resolutionBucket,
      rateBucket,
      completenessBucket,
    ].join('\t'),
  );

  processed++;
  if (processed % 2000 === 0) console.log(`  ...${processed}/${genes.length}`);
}

writeFileSync(join(OUT_DIR, 'mammal-cds-locus-metadata.tsv'), metadataRows.join('\n') + '\n');
console.log(`Wrote metadata for ${genes.length} genes.`);

function toNexus(list: Gene[]): string {
  const lines = ['#NEXUS', 'begin trees;'];
  for (const g of list) lines.push(`tree ${g.locus} = ${g.newick}`);
  lines.push('end;');
  return lines.join('\n') + '\n';
}

writeFileSync(join(OUT_DIR, 'mammal-all-cds.nex'), toNexus(genes));
console.log(`Wrote full set: ${genes.length} genes -> testdata/mammal-all-cds.nex`);

const SAMPLE_SIZE = 1000;
const SAMPLE_SEED = 42;
const sample = seededShuffle(genes, SAMPLE_SEED).slice(0, SAMPLE_SIZE);
writeFileSync(join(OUT_DIR, 'mammal-sample-all-cds.nex'), toNexus(sample));
console.log(`Wrote sample set: ${sample.length} genes -> testdata/mammal-sample-all-cds.nex`);

const astral = readFileSync(join(RESULTS_DIR, 'Laurasiatheria_cds_10259genes_Nuc_speciestree_astral_latin_name.out'), 'utf-8').trim();
writeFileSync(join(OUT_DIR, 'mammal-sample-all-cds-reference.nwk'), astral + '\n');
console.log('Wrote reference tree (real ASTRAL species tree from the paper) -> testdata/mammal-sample-all-cds-reference.nwk');
