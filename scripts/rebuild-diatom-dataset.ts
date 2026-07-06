/**
 * Builds the diatom sample dataset from Roberts, Ruck, Downey, Pinseel &
 * Alverson (2023, Systematic Biology) - "Resolving Marine-Freshwater
 * Transitions by Diatoms Through a Fog of Gene Tree Discordance".
 *
 * Source: the paper's own Dryad-style archive, downloaded into
 * testdata/new/wade-ruck-2023-species-trees/. Uses the "CDS12 complete"
 * analysis (nucleotide positions 1+2, full taxon set): astral-CDS12-complete.zip
 * bundles the real per-locus ML gene trees used as ASTRAL input, the matching
 * locus-name list (same order), and the resulting ASTRAL species tree - all
 * three already share one consistent taxon-naming scheme, so no renaming is
 * needed (unlike the Aphididae set - see rebuild-aphid-dataset.ts).
 *
 * Metadata (num_taxa, tree_length, mean_support) is computed directly from
 * the gene trees themselves - no alignments are included in this archive, so
 * nothing alignment-based (GC%, informative sites, etc.) is available here.
 *
 * Run with: npx tsx scripts/rebuild-diatom-dataset.ts
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ZIP = 'testdata/new/wade-ruck-2023-species-trees/astral-CDS12-complete.zip';
const ENTRY_PREFIX = 'astral-CDS12-complete';
const OUT_DIR = 'testdata';
const PUBLIC_DIR = 'public/sample-data';

const SAMPLE_SIZE = 400;
const SAMPLE_SEED = 42;

interface Gene {
  locus: string;
  newick: string;
}

function unzipRead(entry: string): string {
  return execFileSync('unzip', ['-p', ZIP, `${ENTRY_PREFIX}/${entry}`], { maxBuffer: 1024 * 1024 * 200 }).toString('utf-8');
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

function cleanLocusName(rawPath: string, fallbackIndex: number): string {
  const base = rawPath.split('/').pop() ?? rawPath;
  const cleaned = base.replace(/\.treefile\.collapse75$/, '');
  return cleaned || `locus_${fallbackIndex + 1}`;
}

function treeStats(newick: string) {
  const taxa = [...newick.matchAll(/[(,]([A-Za-z0-9_.\-]+):/g)].map((m) => m[1]);
  const lengths = [...newick.matchAll(/:([0-9.eE+-]+)/g)].map((m) => Number(m[1]));
  const supports = [...newick.matchAll(/\)([0-9]+(?:\.[0-9]+)?):/g)].map((m) => Number(m[1]));
  const treeLength = lengths.reduce((a, b) => a + b, 0);
  const meanSupport = supports.length > 0 ? supports.reduce((a, b) => a + b, 0) / supports.length : NaN;
  return { numTaxa: taxa.length, treeLength, meanSupport };
}

function toNexus(list: Gene[]): string {
  const lines = ['#NEXUS', 'begin trees;'];
  for (const g of list) lines.push(`tree ${g.locus} = ${g.newick}`);
  lines.push('end;');
  return lines.join('\n') + '\n';
}

console.log('Reading gene trees + locus names from the ASTRAL archive...');
const treeLines = unzipRead('CDS12.symtest.trees').trim().split('\n').filter(Boolean);
const nameLines = unzipRead('orthoRT-CDS-pos12.symtest.tree-list.txt').trim().split('\n').filter(Boolean);

if (treeLines.length !== nameLines.length) {
  throw new Error(`Mismatch: ${treeLines.length} trees vs ${nameLines.length} locus names`);
}
console.log(`Found ${treeLines.length} gene trees.`);

const genes: Gene[] = treeLines.map((newick, i) => ({ locus: cleanLocusName(nameLines[i], i), newick }));

const seen = new Set<string>();
for (const g of genes) {
  if (seen.has(g.locus)) throw new Error(`Duplicate locus name after cleaning: ${g.locus}`);
  seen.add(g.locus);
}

console.log('Computing per-locus tree stats...');
const metadataRows: string[] = [['locus', 'num_taxa', 'tree_length', 'mean_bootstrap_support'].join('\t')];
for (const g of genes) {
  const { numTaxa, treeLength, meanSupport } = treeStats(g.newick);
  metadataRows.push([g.locus, numTaxa, treeLength.toFixed(4), Number.isFinite(meanSupport) ? meanSupport.toFixed(1) : ''].join('\t'));
}
writeFileSync(join(OUT_DIR, 'diatoms-cds12-locus-metadata.tsv'), metadataRows.join('\n') + '\n');
writeFileSync(join(PUBLIC_DIR, 'diatoms-cds12-locus-metadata.tsv'), metadataRows.join('\n') + '\n');
console.log(`Wrote metadata for ${genes.length} genes.`);

writeFileSync(join(OUT_DIR, 'diatoms-cds12-complete-all.nex'), toNexus(genes));
console.log(`Wrote full set: ${genes.length} genes -> testdata/diatoms-cds12-complete-all.nex (untracked, >2MB)`);

const sample = seededShuffle(genes, SAMPLE_SEED).slice(0, SAMPLE_SIZE);
writeFileSync(join(OUT_DIR, 'diatoms-sample-cds12.nex'), toNexus(sample));
writeFileSync(join(PUBLIC_DIR, 'diatoms-sample-cds12.nex'), toNexus(sample));
console.log(`Wrote sample set: ${sample.length} genes -> testdata/diatoms-sample-cds12.nex (+ public/sample-data copy)`);

const astral = unzipRead('CDS12.symtest.astral.tree').trim();
writeFileSync(join(OUT_DIR, 'diatoms-sample-cds12-reference.nwk'), astral + '\n');
writeFileSync(join(PUBLIC_DIR, 'diatoms-sample-cds12-reference.nwk'), astral + '\n');
console.log('Wrote reference tree (real ASTRAL species tree from the paper, CDS12/complete-taxa analysis).');
