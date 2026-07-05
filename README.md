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

- **Reference tree**: by default, built as a greedy compatible-splits
  consensus from your input gene/locus trees - clades are added in
  decreasing frequency order, kept whenever compatible with what's already
  accepted. This is a different kind of summary than a Bayesian posterior
  sample or a species-tree inference method, even though the tree looks
  similar in shape. I.e., there is no population- or species-level model of
  *why* gene trees disagree (such as incomplete lineage sorting) - it is a
  frequency tally over the trees you gave it, not a coalescent-aware
  estimate of the species tree. In particular, under high ILS the true
  species tree can differ from the most frequent gene tree topology (the
  "anomaly zone"); this consensus procedure cannot recover that case, by
  construction.
- **Bring your own reference tree**: instead of the built-in consensus, you
  can supply your own reference tree when loading data (e.g. one inferred
  with ASTRAL, StarBEAST2, or any other coalescent-aware species-tree
  method). It must contain every taxon that appears in any of your gene
  trees, and no others - individual gene trees are still allowed to have
  missing taxa, only the reference tree's taxon set has to match the full
  union across all of them. Every branch is then evaluated against that
  tree using the same per-locus
  classification machinery, regardless of where the reference tree came
  from - so this is the way to see discordance/anomaly-zone diagnostics
  against a tree that isn't limited to the majority gene-tree topology.
  Branch lengths are still always re-estimated from your gene trees (an
  average across per-locus observations), not taken from the supplied
  tree's own lengths, so that every branch's length means the same thing.
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

The synthetic datasets are simulated, not derived from any real study.
