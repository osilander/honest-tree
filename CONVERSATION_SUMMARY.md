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

## 12. Methodology questions, and a locus-metadata feature

- Asked whether the app's approach to gene-tree conflict is "easy" because
  ILS is fundamentally different from HGT, where event placement is nearly
  impossible - confirmed the distinction: this app never identifies *why* a
  locus disagrees (ILS, introgression, gene-tree error, or otherwise), only
  *that* and *how much*; HGT placement is hard specifically because it's a
  reconciliation problem where many donor/recipient/timing scenarios can
  produce the same observed conflict. Also asked whether bacterial
  recombination-removal tools (Gubbins, ClonalFrameML) work similarly - yes
  conceptually (detect where a unit of data disagrees with a reference), but
  they scan substitution-density bursts within one alignment and then purge
  the recombinant region to build one "clean" tree, versus this app keeping
  every locus and reporting the full disagreement pattern.
- Asked what metadata to add next. Recommended wiring up the already-declared-
  but-never-populated `LocusMetadata` type (chromosome position, alignment
  length, etc.), which turned into a larger discussion of per-locus stats
  (alignment length, variable/parsimony-informative sites, GC content,
  dN/dS, GO category, codon bias, bacterial factors like core-vs-accessory
  genome) and how they'd surface in the UI. Corrected an imprecision along
  the way: there's no set of loci that "belongs" to a branch - every locus
  gets independently re-classified per branch, so a per-branch comparison
  means regrouping the same fixed locus pool by its branch-specific label,
  not selecting a subset that lives there.
- Asked to build the upload + secondary track, with explicit requirements:
  insist on a column-labeled table, support click-to-toggle for categorical
  columns, and don't crowd the UI. Built a schema-flexible CSV/TSV upload
  (first column = locus-name join key, other columns auto-typed numeric or
  categorical) living in the "Locus tracks" toolbar dropdown, off by default
  until a column is explicitly picked. Verified end-to-end with debug hooks
  then removed them.
- Asked whether it took TSV, and whether locus metadata assumes tree order or
  supports real names. Matching was already by name (not row order); fixed
  delimiter detection to check only the header line and prefer tab (commas
  inside real metadata, e.g. GO term descriptions, could otherwise corrupt a
  naive CSV split). Documented that a plain multi-tree Newick file has no way
  to give a gene tree a real name (so it's always "locus_N" in file order),
  while NEXUS `tree <name> = ...` statements preserve real names end-to-end.
- Asked directly whether any of the mammal data was fake. Answered precisely:
  the core gene trees were real (user-supplied), the "reference tree" file
  was a real reconstruction (not fabricated) but not an authoritative species
  tree, and a few small metadata values used only to test the upload feature
  were fabricated for that purpose and never saved or shipped.

## 13. Rebuilding the mammal dataset from its original source

- Asked to explore `~/Downloads/5259829`, the paper's own data archive, to
  understand its structure. Found: per-gene FASTA alignments, per-gene RAxML
  trees (with real bootstrap support already on the internal nodes, plus raw
  bootstrap-replicate trees in a separate folder), gene-subset membership
  lists matching the paper's GC3%/rate/resolution/completeness subsets
  exactly, and a `results/` folder with the paper's own real ASTRAL species
  trees and concatenated ML trees per subset. Flagged that the app's Newick
  parser already captures bootstrap values into `supportLabel` but never uses
  them downstream, and that the real ASTRAL tree uses the same taxon names as
  the gene trees (no translation needed) - a better reference-tree candidate
  than the earlier half-subsample reconstruction.
- Asked to remove the confusing existing mammal files (`testdata/lauras-cds/`,
  the untracked full/sample tree files) and rebuild them fresh from that
  source, decide whether individual gene trees or just the concatenated set
  are needed, pull all available metadata into one file, and check whether
  %-informative-sites and overall GC% were easy to compute from the
  alignments. Built `scripts/rebuild-mammal-dataset.ts`: combines the
  10,259 real gene trees into NEXUS files (full set + a reproducible
  1000-gene sample) with real gene names, uses the paper's actual ASTRAL
  tree as the reference, and computes alignment length/GC%/variable sites/
  parsimony-informative sites directly from the alignments (confirmed easy -
  one column-scan pass, ~1 minute for all 10,259 genes) alongside the
  paper's own published subset-bucket labels. Wired both the reference tree
  and the metadata table into the sample picker as opt-in checkboxes.
  Left the full 10,259-gene set untracked (~11MB), matching how the file it
  replaced was handled.

## 14. Sort-model simplification, taxon selection, and evidence-panel honesty

- Renamed the mammal sample dataset's dropzone label to cite its source
  directly ("Chen et al. (2017) Laurasiatheria") instead of "Real - mammal
  CDS gene trees", and trimmed the Methods popover's "Reference tree" entry
  down to a shorter statement of the same fact (no population-/species-level
  model of *why* trees disagree), dropping the "Bayesian posterior"/"anomaly
  zone" phrasing from that one panel.
- Replaced the fully independent per-track sort controls built the previous
  round (each of the three locus tracks - whole-tree topology, per-branch
  topology, metadata - had its own on/off/order radio group) with a simpler
  model after direct feedback that the independent version wasn't obvious to
  use: one on/off toggle per track, plus a single shared "sort all shown
  tracks by" selector (chromosome order / whole-tree topology rank / branch
  topology pattern / metadata value) applied uniformly to whichever tracks
  are visible.
- Added a "select taxa to include" mode to the taxon sampler - an
  alphanumerically-sorted checkbox list of every taxon, alongside the
  existing random/most-diverged/all-taxa modes.
- Asked how much sense it makes for the branch evidence panel (support,
  conflict, "wandering taxa") to name taxa that the taxon sampler is
  currently hiding from the tree. Confirmed this was a real, previously
  silent mismatch: the sampler only prunes the *display*, while every number
  and named taxon in the evidence panel is computed from the full dataset
  regardless. Fixed by lifting the sampled-taxa computation up to a single
  place (`App.tsx`) so the tree and every evidence panel agree on exactly
  which taxa are visible (previously each could compute it separately, and
  the unseeded "random" mode could otherwise pick two different subsets for
  the same render), then surfacing the mismatch instead of hiding it: an
  amber caveat banner whenever sampling is active, and a "(hidden)" tag next
  to any named taxon that isn't currently displayed. Declined to also
  recompute the underlying statistics restricted to the visible subset, since
  that would change what a branch's identity even means once taxa are
  dropped, conflicting with the sampler's existing "display-only, preserve
  branch identity" design.
- Renamed the "Locus topology" bar-chart label to "Whole-tree topology" to
  match the toolbar's own wording for the same track and to disambiguate it
  from the per-branch topology track's near-identical label.
- Declined (for now) a requested clade-collapse feature - noted as a
  reasonable follow-up, distinct from the existing threshold-based
  weak-branch collapse, but deferred pending a decision on whether it should
  also stay display-only for the same consistency reason as the taxon
  sampler.
- Asked to bring the README's "Reference tree" bullet and this summary file
  up to date with everything above (this entry).

## 15. Two more real sample datasets

- Added two new real datasets, downloaded by the user into `testdata/new/`,
  and asked to organize them into the same minimally-viable shape as the
  mammal set (concatenated gene trees, plus metadata and a reference tree
  where possible): Roberts, Ruck, Downey, Pinseel & Alverson (2023,
  *Systematic Biology*) on diatom marine-freshwater transitions, and Owen &
  Miller (2022) on Aphididae phylogenomics.
- For diatoms: found that the paper's own "CDS12 complete" analysis archive
  already bundled exactly what was needed - 3259 real per-locus ML gene
  trees, the matching ASTRAL species tree, and a locus-name list, all
  sharing one consistent taxon-naming scheme (verified: the union of taxa
  across the gene trees exactly equals the reference tree's taxa, 86 both
  sides). Built `scripts/rebuild-diatom-dataset.ts`: a reproducible 400-gene
  sample NEXUS file, the real ASTRAL reference tree, and a metadata table
  (`num_taxa`, `tree_length`, `mean_bootstrap_support`) computed directly
  from the gene trees themselves (no alignments are in this archive, so
  nothing alignment-based like GC% is available here).
- For Aphididae: found a harder problem - 4479 real per-orthogroup gene
  trees use short 4-letter taxon codes (e.g. "AFAB"), but the paper's own
  ASTRAL/concatenated species trees use full species names ("Aphis fabae"),
  and no official code-to-species table shipped with the archive. Derived a
  candidate mapping rule (first letter of genus + first three letters of
  species) and checked it against every code that actually appears in the
  gene trees: 44 of 51 matched cleanly, but 7 (e.g. "ADSP", "TASP") didn't -
  most likely genus-level "sp." samples that were dropped before the
  species-resolved tree was built, so no confident rename exists for them.
  Decided against shipping a reference tree built on 7 unverified renames;
  `scripts/rebuild-aphid-dataset.ts` keeps the original codes throughout and
  omits the reference-tree option entirely, letting the app fall back to
  its own consensus (the Dropzone's "use prebuilt reference tree" checkbox
  was made conditional on a sample actually having one, rather than always
  showing regardless of dataset).
- Verified both new sample-picker entries end-to-end in the browser (load,
  reference-tree validation, metadata columns appearing with correct
  numeric typing) before adding citations for both papers to the README's
  "Sample data sources" section.
