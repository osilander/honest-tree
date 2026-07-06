/**
 * Builds the Aphididae sample dataset from Owen & Miller (2022) - "Phylogenomics
 * of the Aphididae: Deep relationships between subfamilies clouded by gene tree
 * discordance, introgression and the gene tree anomaly zone".
 *
 * Source: 4479 real per-orthogroup ML gene trees (with real bootstrap support
 * values, "wBS"), downloaded into
 * testdata/new/owen-miller-2022-aphididae/.
 *
 * No prebuilt reference tree is included here, on purpose: the paper's own
 * ASTRAL/concatenated species trees (in
 * testdata/new/owen-miller-Astral_and_concatenated_spp_trees/) use full
 * species names, while the gene trees use short 4-letter codes, and no
 * official code-to-species table shipped with the archive. A deterministic
 * "first letter of genus + first three of species" rule recovers 44 of the
 * 51 codes seen across the gene trees; the other 7 (e.g. "ADSP", "TASP" -
 * likely genus-level "sp." samples that didn't make it into the final,
 * species-resolved tree) can't be matched with confidence. Rather than ship
 * a reference tree with 7 unverified taxon renames, this dataset keeps the
 * original codes throughout and leaves the reference tree unset, so the app
 * falls back to its own greedy consensus (built from these same gene trees).
 *
 * Metadata (num_taxa, tree_length, mean_bootstrap_support) is computed
 * directly from the gene trees - no alignments are included in this archive.
 *
 * Run with: npx tsx scripts/rebuild-aphid-dataset.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIR = 'testdata/new/owen-miller-2022-aphididae';
const OUT_DIR = 'testdata';
const PUBLIC_DIR = 'public/sample-data';

const SAMPLE_SIZE = 500;
const SAMPLE_SEED = 42;

interface Gene {
  locus: string;
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

function treeStats(newick: string) {
  const taxa = [...newick.matchAll(/[(,]([A-Za-z0-9]+):/g)].map((m) => m[1]);
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

console.log('Reading gene tree files...');
const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.tree'));
console.log(`Found ${files.length} gene tree files.`);

const genes: Gene[] = files.map((f) => ({
  locus: f.replace(/_nucs_wBS\.tree$/, '').replace(/\.tree$/, ''),
  newick: readFileSync(join(SOURCE_DIR, f), 'utf-8').trim(),
}));

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
writeFileSync(join(OUT_DIR, 'aphididae-locus-metadata.tsv'), metadataRows.join('\n') + '\n');
writeFileSync(join(PUBLIC_DIR, 'aphididae-locus-metadata.tsv'), metadataRows.join('\n') + '\n');
console.log(`Wrote metadata for ${genes.length} genes.`);

writeFileSync(join(OUT_DIR, 'aphididae-all.nex'), toNexus(genes));
console.log(`Wrote full set: ${genes.length} genes -> testdata/aphididae-all.nex (untracked, >2MB)`);

const sample = seededShuffle(genes, SAMPLE_SEED).slice(0, SAMPLE_SIZE);
writeFileSync(join(OUT_DIR, 'aphididae-sample.nex'), toNexus(sample));
writeFileSync(join(PUBLIC_DIR, 'aphididae-sample.nex'), toNexus(sample));
console.log(`Wrote sample set: ${sample.length} genes -> testdata/aphididae-sample.nex (+ public/sample-data copy)`);
