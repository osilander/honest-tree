# Phylogenetic Methods Audit

## What the app currently does

This app takes a collection of input trees, usually gene/locus trees, and builds a single reference topology from recurring compatible clades. It then renders that reference tree and summarises, for each reference branch, how often the input trees recover the corresponding clade versus showing local conflicting arrangements.

That is a real and useful summary of multi-tree phylogenetic signal. The core idea makes sense:

- use many input trees to build or compare against one reference tree;
- inspect support and conflict branch-by-branch;
- distinguish agreement, disagreement, missingness, and local taxon movement;
- avoid pretending the reference tree is uniformly well supported.

The app should be described as a **branch-centric gene-tree conflict browser** or **clade/split recovery browser**, not yet as a formal gCF/bootstrap/posterior support viewer.

## Main methodological change

Do **not** throw away the current logic. It is useful.

Instead, separate two layers:

1. **Current exploratory layer**
   - clade/split recovery across input trees;
   - local conflict patterns;
   - extra taxa / moving taxa diagnostics;
   - missingness summaries.

2. **Future formal support layer**
   - true quartet-style gCF;
   - true bootstrap/posterior support if imported or parsed;
   - explicit alternative quartet resolutions;
   - explicit non-decisive/unresolved categories.

The current method is quartet-like in spirit, but it is not yet formal quartet logic.

## Required changes

### 1. Rename the current "gCF" metric

The current `gCF (simplified)` is better described as:

- `Clade recovery`
- `Split recovery`
- `Gene-tree split frequency`
- `Reference clade recovery`

Suggested UI label:

> Clade recovery (% decisive loci)

Suggested tooltip:

> Fraction of testable input trees in which this reference clade/split is recovered. This is not standard quartet gCF.

Why:

The current calculation is essentially:

```text
reference-clade matches / decisive input trees
```

That is useful, but standard gCF usually asks a stricter quartet question around an internal branch: among gene trees that contain enough sampled taxa from the four sides of the branch, how many support the reference quartet resolution versus the two alternative resolutions?

So the app should not present the current value as plain `gCF`.

### 2. Add true quartet-style gCF later

Keep the existing clade-recovery logic as an exploratory diagnostic, but add a separate formal metric later.

A true branch-level gCF view should classify each input tree for each internal reference branch into something like:

```text
reference quartet resolution
alternative quartet resolution 1
alternative quartet resolution 2
non-decisive / missing
unresolved / uninformative
```

This would let the app say:

```text
Reference: 61%
Alternative 1: 24%
Alternative 2: 9%
Non-decisive or unresolved: 6%
```

What this buys:

- a cleaner denominator;
- two explicit local alternatives;
- better separation of missing data from real conflict;
- easier comparison with standard phylogenetic concordance methods.

What the current method still buys:

- better exploratory explanation of *which taxa* are moving;
- local pattern diagnostics;
- practical insight into rogue taxa, paralogy, contamination, missing data, or locus-specific instability.

The final app should ideally show both:

```text
Formal quartet summary: what resolution does each gene tree support?
Diagnostic local-pattern summary: which taxa/clades seem responsible?
```

### 3. Remove unsupported support metrics from the current UI

The app should remove or disable support metric buttons/options that are not currently supported by loaded data.

Remove from the active UI for now:

- `Bootstrap`
- `Posterior`

Keep the type/model logic if useful for future implementation, but do not expose them as selectable metrics until real values are parsed, imported, or computed.

Why:

At the moment, selecting Bootstrap or Posterior does not show real bootstrap or posterior support. Those values are not populated from the loaded input, and the metric helper falls back to the clade recovery value. That is misleading.

Acceptable temporary UI:

```text
Support metric:
- Clade recovery
```

Future UI:

```text
Support metric:
- Clade recovery
- Quartet gCF
- Bootstrap, if available
- Posterior probability, if available
```

Unavailable future metrics should appear disabled or hidden, not silently substituted.

### 4. Make consensus-tree wording precise

The current reference tree should be described as a **greedy compatible-splits consensus/reference tree**, not as a generic consensus tree without qualification.

The app is doing something broadly similar in shape to Bayesian consensus summaries: count recurring clades/splits and draw a compatible set of them. But the interpretation is different.

For MrBayes-style posterior tree samples:

```text
86% means: 86% of posterior sampled trees contain this clade.
```

For this app's gene-tree collection:

```text
86% means: 86% of input gene/locus trees recover this clade, among testable trees.
```

Those are not the same kind of uncertainty.

Recommended language:

> The reference topology is built from recurring compatible clades across the input trees. Branch summaries report gene-tree clade recovery and conflict around that reference.

Avoid language implying:

- posterior probability;
- bootstrap support;
- formal species-tree inference;
- standard gCF, until implemented.

### 5. Treat branch lengths on consensus trees conservatively

Consensus trees do not naturally have branch lengths in the same way an inferred single tree does. A branch may not even exist in many input trees.

Recommended default:

- draw the consensus/reference as a cladogram;
- make branch-length display optional;
- label any branch-length mode clearly.

Preferred future branch-length modes:

- `Exact split mean length`: average lengths only from input trees that contain the exact split;
- `Exact split median length`: same, but median;
- `User/reference tree lengths`: if the user supplies a reference tree with lengths.

Avoid making enclosing-clade proxy lengths look like true consensus branch lengths. If proxy lengths are kept, label them explicitly as approximate display lengths.

### 6. Add explicit unresolved / uninformative states

The current branch summary has useful missingness handling, but it should more explicitly distinguish:

- present and concordant;
- present and supporting a specific alternative;
- present but unresolved/uninformative;
- non-decisive because relevant taxa are missing.

This matters because weak support can mean very different things:

```text
The branch is contradicted.
The branch is not testable.
The locus tree is unresolved.
The relevant taxa are missing.
```

The app's value is highest when those cases are visibly different.

## Short implementation checklist

1. Rename current `gCF (simplified)` UI text to `Clade recovery` or `Split recovery`.
2. Remove `Bootstrap` and `Posterior` from the active support metric dropdown until real values exist.
3. Keep dormant bootstrap/posterior types if desired, but never silently fallback in the UI.
4. Add docs/tooltips defining the current clade-recovery denominator.
5. Rename current conflict summaries as `local conflict patterns` or `taxon movement diagnostics`.
6. Add true quartet-gCF classification as a separate future metric.
7. Default consensus branch rendering to cladogram or clearly label branch-length provenance.
8. Add explicit unresolved/uninformative categories.

## Bottom line

The app's phylogenetic logic is directionally sensible. It is already summarising how many input trees recover each reference branch and where they conflict.

The main fix is precision:

```text
Current: "gCF / bootstrap / posterior support"
Better:  "clade recovery and local gene-tree conflict"
Future:  "true quartet gCF plus clade-recovery diagnostics"
```

