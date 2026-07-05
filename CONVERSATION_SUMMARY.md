# Conversation Summary

A chronological summary of what was asked for over the course of building this
app (the "Phylogenetic Uncertainty Browser", repo name `honest-tree`). This is
a summary of intent, not a verbatim transcript - grouped into the rough order
things were requested and built.

## 1. Initial build

- Build a browser-based tool for exploring conflict/uncertainty across a set
  of gene trees, per a design spec (`tree-browser-readme.md`): parse
  Newick/NEXUS multi-tree files, build a consensus reference tree, compute a
  simplified gCF-style per-branch concordance metric, render the tree with
  D3/SVG, support hover/click on branches with a "Support" color-encoding
  mode, show a Branch Evidence Panel with a deterministic natural-language
  report, and an Edge Histogram of topology support per branch.
- Add a threshold slider to collapse weak branches, drag-and-drop file
  loading, and synthetic test gene trees to smoke-test in the browser.

## 2. Dynamic pattern system and UI polish

- Move from a fixed "concordant/discordant" model to a dynamic set of named
  topology patterns (Reference / Alternative A / B / ... ranked by
  frequency), with matching colors, histogram bars, and evidence-panel
  listings.
- Add global topology ranking and a locus track (gene trees plotted in file
  order or sorted by rank, colored by which topology each one matches).
- Toolbar controls for text size, line thickness, showing support values;
  remove an unused "balanced" branch-centering option; fix branch-length
  discretization and support-label positioning bugs.
- Add taxon instability scoring (which taxa most often "wander" and cause
  conflict at a branch), and have the natural-language report name them.
- Add an expandable missing-taxa breakdown, search/jump-to-taxon with branch
  highlighting, a "copy branch report" button, and SVG/PDF export.
- Add a separate "Evidence" render mode (distinct blue/yellow/grey encoding
  from "Support"), per-branch local split notation (nested Reference vs.
  Alternative bipartitions), and a "view as tree" toggle to see the local
  split as two small dendrograms.
- Add a taxon sampler (random or most-diverged subsampling) that preserves
  branch identity across resamples; general aesthetic polish.

## 3. Deployment and workflow

- Set up the git repo and a GitHub Actions workflow to deploy to GitHub
  Pages; add a "re-root here" feature; add a loading-progress indicator for
  large uploads (parsing/computation can take 20-90+ seconds on datasets with
  thousands of loci); decide what test data to track in git (everything
  except files over 2MB, with `public/sample-data/` as an exception since the
  deployed app needs to serve those files regardless of size); collapse the
  toolbar into dropdown menus to reduce clutter.

## 4. Branch-length provenance and histograms

- Question: was it possible to show the distribution of branch lengths as a
  small histogram, e.g. on hover? After discussing that exact vs. approximate
  ("fallback") length observations shouldn't be silently mixed, the request
  became: show that distinction with two colors. This became the hover-tooltip
  length histogram (blue = exact clade observation, grey = coarser fallback).

## 5. UI decluttering

- Remove the raw bipartition-text legend rows from the Edge Histogram (kept
  just the tag + count, with the full text moved to a hover title) and remove
  the "Taxa / Side A / Side B" section from the Branch Evidence Panel
  entirely (redundant with the "view as tree" popup).

## 6. Synthetic data bug hunt and regeneration

- Reported that branch lengths looked artificially uniform (~0.01-0.5, always
  maxing near 0.5) on the 30-taxa sample datasets, and that GitHub Pages
  seemed to be serving a version with equal-ish lengths regardless of which
  dataset was loaded. Two independent causes were found and fixed: (a) an
  artificial "root spans all taxa" node was falling back to a hardcoded
  length of 1, dwarfing real (much smaller) branch lengths; (b) a GitHub
  Pages deploy had failed at the `deploy-pages` step (confirmed via the
  Actions API), unrelated to the code.
- Asked to regenerate all sample data as clearly-labeled synthetic sets with
  a more realistic branch-length distribution, and to produce four sets (25
  and 50 taxa, at 500 and 5000 loci each), removing the old "real" and
  30-taxa synthetic files. This also surfaced a second bug (discordance was
  too weak/evenly spread across branches) fixed by weighting which branch
  each locus's simulated rearrangement lands on, so a handful of branches are
  deliberately "hot" and unstable rather than everything being 96-98%
  concordant.
- Independently, confirmed deletion of an old bird-exon test dataset and
  added a new real mammalian-CDS gene-tree dataset, including pushing it and
  later exposing it as a selectable "sample dataset" in the dropzone.

## 7. Report-text correctness bug

- Reported a self-contradictory natural-language report (a branch described
  as having conflict "concentrated in a single alternative" while also
  listing 10+ alternatives, each "individually weak", with no single
  alternative actually dominant). Root cause: both the report text and the
  underlying conflict classification were including the collapsed "other"
  tail (a sum of many small alternatives) when computing "the top
  alternative", letting that tail outrank any real single alternative purely
  by being a sum. Fixed in both places and verified against the real branch
  that prompted the question.

## 8. Methodology audit (`issues.md`) and follow-through

- The user added a self-authored methodology audit document (`issues.md`)
  raising several concerns: the "gCF" label implies a different (quartet-
  based) statistic than what's computed; Bootstrap/Posterior support fields
  are shown in the UI but never actually populated (silently falling back to
  the same clade-recovery number); branches with zero decisive loci don't
  distinguish *why* (missing taxa vs. genuinely uninformative loci); and
  general wording precision around what the consensus tree represents.
- Agreed to address the top three items: hide the unsupported Bootstrap/
  Posterior UI, rename "gCF (simplified)" to "Clade recovery" everywhere, and
  add a real "uninformative" locus category (taxa present, but no coherent
  signal for the reference or any specific alternative) distinct from
  "missing" (taxa absent).
- Decided - after being asked to choose between a README section, an in-app
  glossary, or both - to do both: a "What this app does and doesn't do"
  section in the README, and a small in-app "Methods" popover (info button in
  the header) covering the same points plus a "not yet implemented" list.

## 9. Topology-track legend toggling

- Asked for the per-locus topology color tracks (both the global "locus
  topology, chromosome order" track and the per-branch track) to have
  clickable legend entries, so any topology/category can be toggled on/off
  to make subtler patterns easier to see against the dominant ones (e.g.
  "view this without topology B and C"). Implemented as click-to-toggle
  legend buttons on both tracks; hidden categories fade to the page
  background color rather than being removed, so relative positions along
  the track are preserved.

## 10. This summary

- Asked for this file: a chronological, non-exhaustive summary of the
  prompts/requests across the whole conversation.

## 11. Reference-tree wording, glossary follow-through, and a "bring your own" feature

- Asked to clarify, in both the README and the Methods popover, exactly what
  "not species-tree inference" means for the built-in consensus tree - added
  language naming the specific mechanism (no population-/species-level model
  of *why* gene trees disagree, e.g. incomplete lineage sorting) and the
  concrete consequence (can't recover "anomaly zone" branches where the true
  species tree differs from the most common gene tree topology).
- Asked whether it would be easier to let users supply an externally-inferred
  reference tree (e.g. from ASTRAL or StarBEAST2) instead of the app's own
  greedy consensus, or whether that just moves the hard part elsewhere. After
  discussion (the per-locus classification machinery only needs the reference
  tree's splits, not its origin, so accepting an external tree doesn't add a
  new hard problem), asked to build it: an optional second file upload for a
  user-supplied reference tree, validated to contain exactly the taxon union
  across the gene trees (individual gene trees may still be missing taxa -
  wording was corrected after the first pass conflated the two). The header
  now shows where the reference tree came from.
- Asked for the topology-support color legend (below the chromosome-order
  track) to be clickable on/off per topology, to make subtler patterns
  visible against a dominant one - already covered in section 9, extended
  here to also cover the per-branch track the same way.
- Asked for a legend explaining what branch color/thickness mean in the main
  tree view itself (not just the locus tracks), as a dropdown so it doesn't
  permanently occupy screen space. Added a "Legend" toolbar dropdown whose
  content updates live to match whichever render mode (Support/Conflict/
  Evidence) is currently selected.
- Asked for the data-warnings banner to be fully dismissible with an X, not
  just collapsible - added a separate dismiss control, reset on each new
  dataset load.
- Asked for a reference tree for the mammal sample and the four synthetic
  samples, suggesting an averaged-subset approach. Since no true/ground-truth
  tree survived from the (uncommitted) synthetic-data generator, and the
  mammal set has no known species tree either, built a small script
  (`scripts/gen-reference-trees.ts`) that constructs each sample's reference
  tree from a reproducible random half of its own gene trees, using the app's
  existing consensus + branch-length machinery. Wired these into the sample
  picker as an opt-in checkbox. Checked honestly whether this actually
  produces a different topology from the full-dataset consensus: yes for the
  mammal set (1 of 19 branches), no for any of the four synthetic sets even
  down to a 10% subsample (logged, not hidden).
- Asked for a citation to be added crediting the source of the mammal sample
  dataset (Chen, Liang & Zhang 2017, *Genome Biology and Evolution*).
- Asked for Conflict render mode to use continuous red shading like Evidence
  mode's gradient, instead of five flat categorical colors. Replaced the
  categorical color with a continuous slate-to-red gradient driven by the
  same value already used for branch width, so width and color reinforce one
  signal; the specific conflict category (concentrated/contradicted/diffuse)
  is no longer separately color-coded on the tree but remains available by
  clicking a branch. Legend updated to match.
