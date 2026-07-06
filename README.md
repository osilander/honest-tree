# Phylogenetic Uncertainty Browser

Design spec: [tree-browser-readme.md](./tree-browser-readme.md)

## Run

```
npm install
npm run dev
```

Then open the printed localhost URL and drag a multi-tree Newick/NEXUS file
(a set of gene trees) onto the page.

## What this app does and doesn't do

This is a **branch-centric gene-tree conflict browser**, not a formal
gCF/bootstrap/posterior support viewer (yet). Specifically:

- **Reference tree**: by default, a greedy compatible-splits consensus from
  your input gene trees - clades are added in decreasing frequency order,
  kept whenever compatible with what's already accepted. There is no model
  of *why* trees disagree (e.g. incomplete lineage sorting); it's a
  frequency tally, not a coalescent-aware estimate of the species tree. You
  can instead supply your own reference tree (e.g. a proper species-tree
  estimate) when loading data - every branch is then evaluated against that
  tree instead.
- **Bring your own reference tree**: instead of the built-in consensus, you
  can supply your own reference tree when loading data (e.g. one inferred
  with ASTRAL, StarBEAST2, or any other coalescent-aware species-tree
  method). It must contain every taxon that appears in any of your gene
  trees, and no others - individual gene trees are still allowed to have
  missing taxa, only the reference tree's taxon set has to match the full
  union across all of them. Every branch is then evaluated against that
  tree using the same per-locus classification machinery, regardless of
  where the reference tree came from - so this is the way to see
  discordance against a tree that isn't limited to the majority gene-tree
  topology. Branch lengths are still always re-estimated from your gene
  trees (an average across per-locus observations), not taken from the
  supplied tree's own lengths, so that every branch's length means the same
  thing.
- **"Clade recovery" (the `Clade recovery` metric)**: the fraction of
  decisive input trees in which a branch's exact reference clade is
  recovered. This is clade/split recovery frequency, **not** the formal
  quartet-based gCF statistic (which asks a stricter question: among the
  four subtrees around a branch, does each gene tree support the reference
  quartet resolution, one of the two alternatives, or neither?).
- **No bootstrap or posterior support** is computed, parsed, or imported
  anywhere in the app - there's nothing to select in the UI for either,
  since showing a value there would just silently substitute the clade
  recovery number, which is misleading.
- **Missing vs. uninformative loci** are tracked as two distinct
  categories, both excluded from "decisive loci": *missing* means too few
  of the branch's taxa are present in that locus to test it at all;
  *uninformative* means all the relevant taxa are present, but that locus's
  placement of them doesn't align with the reference clade or with any
  identifiable local alternative - there's no coherent rival topology to
  name, just scatter.
- **Branch lengths** on the reference tree are estimates, not exact -
  averaged per branch from whichever gene trees provide a usable reading,
  distinguishing *exact* observations (the gene tree displays this precise
  clade) from *fallback* observations (a coarser enclosing clade stood in
  for it). Hover a branch to see the underlying distribution and that
  exact/fallback split.
- **Per-locus metadata (optional)**: you can upload a TSV/CSV of arbitrary
  per-locus values - alignment length, GC%, dN/dS, GO category,
  chromosome, whatever you already have - alongside your gene trees,
  joined by locus name (any row order, any subset). This app has no
  alignment parser of its own, so any such data always has to come from
  outside. Numeric columns render as a continuous secondary locus track;
  categorical columns get click-to-toggle swatches, same as the topology
  tracks (e.g. isolate loci on one chromosome by hiding the rest).

The app's diagnostic value is in the second half of this list - local
conflict patterns, taxon-movement diagnostics, and missing-vs-uninformative
separation - not in presenting a single point-estimate tree as if every
number on it were a formal, off-the-shelf phylogenetic statistic.

## Sample data sources

The mammal CDS gene-tree sample dataset is derived from:

> Chen, M.-Y., Liang, D., & Zhang, P. (2017). Phylogenomic Resolution of the
> Phylogeny of Laurasiatherian Mammals: Exploring Phylogenetic Signals within
> Coding and Noncoding Sequences. *Genome Biology and Evolution*, 9(8),
> 1998-2012.

Rebuilt directly from that paper's public data archive (not hand-edited),
via `scripts/rebuild-mammal-dataset.ts`:
- the sample is a reproducible random 1000-gene draw from the paper's full
  10,259 CDS gene trees, kept as a NEXUS file with real per-gene tree names
  (Ensembl gene ID + symbol) rather than anonymous "locus_N" names;
- its "prebuilt reference tree" option is the paper's own real ASTRAL
  species tree, not a reconstruction built by this app;
- its "prebuilt metadata" option is a per-locus table (all 10,259 genes)
  with alignment length, overall GC%, and variable/parsimony-informative
  site counts computed directly from the alignments, plus the paper's own
  GC3%/evolutionary-rate/resolution/completeness subset-membership labels
  (read from its published gene lists, not recomputed).

The diatom gene-tree sample dataset is derived from:

> Roberts, W. R., Ruck, E. C., Downey, K. M., Pinseel, E., & Alverson, A. J.
> (2023). Resolving Marine-Freshwater Transitions by Diatoms Through a Fog of
> Gene Tree Discordance. *Systematic Biology*, 72(5), 984-997.

Built via `scripts/rebuild-diatom-dataset.ts` from the paper's own archive
(the "CDS12 / complete taxon set" analysis - nucleotide codon positions 1+2,
no taxa dropped for missingness):
- the sample is a reproducible random 400-gene draw from the 3259 real
  per-locus ML gene trees that were this analysis's actual ASTRAL input,
  named after their original orthogroup identifiers;
- its "prebuilt reference tree" option is the paper's own real ASTRAL
  species tree for this same analysis - taxon names already match the gene
  trees exactly, no renaming needed;
- its "prebuilt metadata" option (`num_taxa`, `tree_length`,
  `mean_bootstrap_support` per locus) is computed directly from the gene
  trees themselves - this archive doesn't include the underlying
  alignments, so nothing alignment-based (GC%, informative sites) is
  available for this dataset.

The Aphididae gene-tree sample dataset is derived from:

> Owen, C. L., & Miller, G. L. (2022). Phylogenomics of the Aphididae: Deep
> relationships between subfamilies clouded by gene tree discordance,
> introgression and the gene tree anomaly zone. First published 17 March
> 2022.

Built via `scripts/rebuild-aphid-dataset.ts` from the paper's own archive of
4479 real per-orthogroup ML gene trees (with real bootstrap support):
- the sample is a reproducible random 500-gene draw, named after their
  original orthogroup cluster identifiers;
- its "prebuilt metadata" option (`num_taxa`, `tree_length`,
  `mean_bootstrap_support` per locus) is computed directly from the gene
  trees, for the same reason as the diatom set above;
- **no prebuilt reference tree is offered for this dataset.** The paper's
  own ASTRAL/concatenated species trees use full species names, while the
  gene trees use short 4-letter codes, and no official code-to-species
  table shipped with the archive. A deterministic "first letter of genus +
  first three of species" rule recovers 44 of the 51 codes seen across the
  gene trees; the other 7 (e.g. "ADSP", "TASP" - likely genus-level "sp."
  samples that didn't make it into the final, species-resolved tree) can't
  be matched with confidence. Rather than ship a reference tree built on 7
  unverified taxon renames, this dataset keeps the original codes
  throughout and falls back to the app's own consensus tree.

The synthetic datasets are simulated, not derived from any real study.
