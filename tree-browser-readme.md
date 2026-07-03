# Phylogenetic Uncertainty Browser

## Goal

Build a browser-based interactive visualisation app for exploring phylogenetic uncertainty.

The app should show one primary reference phylogeny — the “Honest Tree” — and allow users to switch between different evidence overlays using radio buttons. The app should not default to side-by-side trees or many overplotted trees.

The central idea is:

> A phylogenetic tree should not only show a support value. It should let users inspect why each branch is supported, contradicted, weak, or unresolved.

The application is branch-centric. Each internal branch/split has evidence behind it: support values, gene/site concordance, alternative topology support, missingness, and locus-level provenance. The UI should make that evidence inspectable.

---

## Core UI

Use a layout like this:

text ┌──────────────────────────────────────────────┬──────────────────────────────┐ │ Toolbar                                      │ Branch Evidence Panel         │ ├──────────────────────────────────────────────┤                              │ │                                              │ Natural-language report       │ │              Honest Tree View                │ Edge histogram                │ │                                              │ Split barcode                 │ │                                              │ Support provenance            │ │                                              │ Counts / metadata             │ └──────────────────────────────────────────────┴──────────────────────────────┘  Optional lower panel or tab: Conflict Matrix / Heatmap 

Approximate proportions:

text Tree view: 65–75% width Branch evidence panel: 25–35% width Conflict matrix: collapsible lower panel or separate tab 

---

## Main Principle

There should be one stable tree topology in the main view.

Radio buttons should change the uncertainty overlay on that same tree. They should not replace the entire visual metaphor or introduce a second tree by default.

A side-by-side compare mode can be added later, but it should not be the default.

---

## Primary Components

### 1. Honest Tree View

The main visualisation.

Render a reference tree using a fixed topology. The topology may come from a consensus tree, species tree, maximum-clade-credibility tree, or user-supplied Newick tree.

The tree should support:

text zoom pan tip-label toggle branch-length / cladogram toggle branch hover branch click selected-branch highlighting threshold-based branch collapse mode-specific uncertainty overlays 

Branches should be selectable. Selecting a branch updates the Branch Evidence Panel.

---

### 2. Toolbar

The toolbar should contain global controls.

Required controls:

text Render mode radio buttons Support threshold slider Collapse weak branches toggle Tip labels toggle Branch length / cladogram toggle Reset view button 

Suggested render modes:

text Support Conflict Evidence Histogram Barcode Lens 

Only one render mode should be active at a time.

---

### 3. Branch Evidence Panel

This panel updates when a user selects a branch.

Before a branch is selected, show a short instruction such as:

text Select a branch to inspect support, conflict, and locus-level evidence. 

For a selected branch, show:

text Branch ID / split ID Natural-language branch report Support metrics Edge histogram Split barcode Support provenance Raw counts Relevant taxa/clades Optional locus/gene table 

---

### 4. Conflict Matrix / Heatmap

This is a secondary linked view.

Rows represent branches/splits.

Columns represent genes, loci, windows, sites, or partitions.

Cells represent support state:

text concordant alternative_1 alternative_2 uninformative missing low_confidence other 

Interactions:

text click matrix row -> select corresponding branch on tree click tree branch -> highlight corresponding matrix row click matrix column -> show locus/gene metadata sort columns by chromosome, coordinate, gene, missingness, or support state filter rows by support, conflict, missingness, or evidence density 

This matrix does not need to be shown by default. It can be a collapsible panel or tab.

---

## Render Modes

### Support Mode

Question answered:

> Which branches are strongly or weakly supported?

Branch encoding:

text branch width = support or concordance branch opacity = amount of decisive evidence branch colour = mostly neutral 

Possible support metrics:

text bootstrap posterior probability gene concordance factor site concordance factor proportion of concordant decisive loci 

Suggested mapping:

text width = scale(branch.support.gcf or branch.support.bootstrap) opacity = scale(branch.counts.decisive_loci / branch.counts.total_loci) 

---

### Conflict Mode

Question answered:

> Which branches are contradicted, and what kind of conflict dominates?

Branch encoding:

text branch colour = dominant conflict class branch width = amount of discordance branch opacity = decisiveness 

Conflict classes:

text low_conflict alt1_dominant alt2_dominant diffuse_conflict missing_data uninformative 

A branch with low support because of missing data should look different from a branch with low support because many loci support a specific alternative.

---

### Evidence Mode

Question answered:

> How much usable evidence exists for this branch?

Branch encoding:

text branch width = number of decisive loci/sites/genes branch opacity = fraction of informative evidence branch colour = optional evidence category 

This mode should help users distinguish:

text weak because contradicted weak because uninformative weak because missing data 

---

### Histogram Mode

Question answered:

> What is the support breakdown for each branch?

Render branches as compact stacked edge histograms.

Segments should represent:

text concordant/reference support alternative 1 alternative 2 uninformative missing/other 

This mode can become visually dense. Prefer one of these behaviours:

text show histograms only for selected branch and nearby branches show histograms only at sufficient zoom level show histograms only inside the Focus Lens 

Do not clutter the full tree at low zoom.

---

### Barcode Mode

Question answered:

> Which specific loci/windows/genes support or contradict this branch?

For a selected branch, show a split barcode.

Each tick represents one locus, gene, window, site group, or partition.

States:

text concordant alternative_1 alternative_2 uninformative missing low_confidence 

Recommended behaviour:

text selected branch gets a compact barcode full barcode appears in the Branch Evidence Panel full branch × locus view appears in the Conflict Matrix 

Do not render full barcodes on every branch by default.

---

### Lens Mode

Question answered:

> Can I inspect local uncertainty without cluttering the whole tree?

The tree remains clean outside the lens. Inside the lens, show richer detail.

Possible lens behaviours:

text hover lens click-to-lock lens drag lens selected-branch neighbourhood lens 

Inside the lens, render local uncertainty details such as:

text edge histograms split barcodes support labels conflict colours nearby weak branches 

This is optional for the first build, but the renderer should be designed so local branch rendering can be customised.

---

## Threshold Slider

The support threshold slider should always be available.

Example:

text Show/collapse branches with support below: [ 50% ] 

The threshold can operate on:

text bootstrap posterior probability gCF sCF concordant decisive loci 

Behaviour:

text branches below threshold may be faded branches below threshold may be collapsed collapsed weak branches become polytomies users can toggle collapse on/off 

This is central to the “Honest Tree” idea: weakly supported structure should not always be shown as fully resolved.

---

## Branch Evidence Panel Details

For a selected branch, show the following.

### Natural-Language Report

Generate a deterministic text summary from branch data.

Example:

text This branch is moderately supported. Of 118 decisive loci, 75 support the reference split, 29 support the nearest alternative, and 10 support a second alternative. Four loci are uninformative or missing. Site concordance is lower than gene concordance, suggesting that many loci contain weak or mixed signal. Discordant loci are enriched among short alignments and loci missing Taxon_X. 

This should not require an LLM. It can be templated from available metrics.

The report should explicitly distinguish:

text strong support weak but not contradicted weak because missing/uninformative weak because strongly contradicted diffuse conflict specific alternative conflict 

---

### Edge Histogram

Show a stacked bar for the selected branch.

Segments:

text concordant/reference alternative_1 alternative_2 uninformative missing/other 

Use counts and percentages.

Example data:

json {   "concordant": 75,   "alternative_1": 29,   "alternative_2": 10,   "uninformative": 4,   "missing": 0 } 

---

### Split Barcode

Show locus-level support states for the selected branch.

Example:

text gene001  concordant gene002  alternative_1 gene003  uninformative gene004  concordant gene005  missing 

The barcode should support sorting by:

text input order chromosome/coordinate gene name state alignment length missingness 

Hovering over a tick should reveal locus metadata.

---

### Support Provenance

Show where support and conflict come from.

Possible groupings:

text chromosome genomic coordinate bin gene window partition marker type alignment length bin missing-data bin GC bin model taxon completeness 

Example display:

text Support is concentrated in long loci. Discordance is enriched among short loci and loci missing Taxon_X. Chromosome 7 contributes disproportionately to alternative_1 support. 

This should be computed from metadata if available. If not available, hide this section or show “No provenance metadata available.”

---

## Data Model

Use a split-centric data model.

The app should not rely only on node numbers, because node numbers can change. Each branch should have a stable split_id.

Example branch object:

json {   "branch_id": "branch_042",   "split_id": "split_042",   "taxa_left": ["A", "B", "C"],   "taxa_right": ["D", "E", "F"],   "parent_node": "node_17",   "child_node": "node_42",   "support": {     "bootstrap": 92,     "posterior": 0.98,     "gcf": 63.4,     "scf": 41.2   },   "counts": {     "total_loci": 125,     "decisive_loci": 118,     "concordant_loci": 75,     "alternative_1_loci": 29,     "alternative_2_loci": 10,     "uninformative_loci": 4,     "missing_loci": 7   },   "dominant_conflict": "alternative_1",   "locus_states": {     "gene001": "concordant",     "gene002": "alternative_1",     "gene003": "uninformative",     "gene004": "concordant",     "gene005": "missing"   },   "metadata_summary": {     "conflict_enriched_in": ["short_loci", "chr7"],     "missing_taxa": ["Taxon_X"]   } } 

Locus metadata object:

json {   "locus_id": "gene001",   "label": "gene001",   "chromosome": "chr1",   "start": 102030,   "end": 108900,   "alignment_length": 6870,   "missing_taxa": [],   "gc": 0.43,   "partition": "coding",   "tree_file": "gene001.tree" } 

Tree object:

json {   "newick": "((A,B),(C,(D,E)));",   "branches": [],   "loci": [] } 

---

## Internal State

Maintain application state like this:

json {   "selectedBranchId": null,   "hoveredBranchId": null,   "renderMode": "support",   "supportMetric": "gcf",   "threshold": 50,   "collapseWeakBranches": true,   "showTipLabels": true,   "treeLayout": "rectangular",   "useBranchLengths": true,   "matrixVisible": false,   "barcodeSort": "genomic_order" } 

---

## Interactions

### Hover branch

On hover:

text highlight branch show tooltip with compact support summary optionally highlight corresponding matrix row 

Tooltip should include:

text branch/split ID support metric concordant / discordant / uninformative counts dominant conflict 

---

### Click branch

On click:

text set selectedBranchId highlight selected branch update Branch Evidence Panel highlight corresponding row in Conflict Matrix 

---

### Change render mode

On radio-button change:

text keep same selected branch keep same tree topology update branch visual encoding do not reset zoom/pan do not reset selected branch 

---

### Adjust threshold

On threshold change:

text fade or collapse branches below threshold update tree rendering preserve selected branch if possible update summary if selected branch is affected 

---

### Click matrix row

On matrix row click:

text select corresponding branch scroll/zoom tree to branch if feasible update Branch Evidence Panel 

---

### Click matrix column

On matrix column click:

text show locus metadata optionally highlight cells/states for that locus optionally highlight tree branches supported/contradicted by that locus 

---

## Rendering Notes

The first implementation can use:

text React TypeScript D3 SVG 

SVG is preferable for the first version because branch-level interactions and styling are easier.

For very large trees or dense matrices, add Canvas/WebGL later.

Suggested components:

text App Toolbar HonestTree Branch BranchTooltip BranchEvidencePanel EdgeHistogram SplitBarcode SupportProvenance ConflictMatrix ThresholdSlider 

---

## Visual Encoding Guidelines

Do not overload the default tree.

Default Support mode should be restrained:

text branch width = support/concordance branch opacity = decisiveness colour mostly neutral only clearly conflicted branches get warning colour 

Avoid showing all of these at once by default:

text width colour opacity labels histograms barcodes lens tooltips collapse effects 

The user should be able to progressively reveal detail.

---

## Recommended MVP

Build in this order.

### MVP 1

text Load tree and branch metadata Render Honest Tree Add zoom/pan Add branch hover and click Add Support mode Add Branch Evidence Panel Add Natural-Language Report Add Edge Histogram Add threshold slider 

### MVP 2

text Add Conflict mode Add Evidence mode Add Split Barcode Add collapse weak branches Add selected-branch highlighting 

### MVP 3

text Add Conflict Matrix / Heatmap Link tree branch selection to matrix rows Link matrix rows back to tree Add locus metadata hover 

### MVP 4

text Add Histogram mode Add Barcode mode Add Lens mode Add support provenance summaries Add filtering and sorting 

---

## Features Not in Core Scope

Do not implement these in the first version:

text permanent side-by-side tree comparison DensiTree-style full tree overplotting splits network tree-space / MDS plot topology simplex animated posterior tree scrubber local topology morphing 

These may be added later, but they are not part of the core product.

---

## Scientific Interpretation Rules

The UI should be careful not to imply false certainty.

Important distinctions:

text low support because few loci are informative low support because many loci support a specific alternative low support because data are missing low support because discordance is diffuse high gene concordance but low site concordance high support concentrated in one data class 

The Branch Evidence Panel should explicitly describe these differences.

---

## Example Natural-Language Report Logic

Pseudo-rules:

text if concordant proportion high and discordance low:   "This branch is strongly supported across decisive loci."  if concordant low and alternative_1 high:   "This branch is strongly contradicted by a specific alternative topology."  if decisive_loci low:   "This branch has limited decisive evidence; low support appears to reflect weak or missing signal rather than strong conflict."  if alternative_1 and alternative_2 both moderate:   "Conflict is diffuse across multiple alternatives."  if missing_loci high:   "Interpretation is limited by missing data."  if gcf high but scf low:   "Gene-level concordance is stronger than site-level concordance, suggesting individual loci may contain weak or mixed signal." 

---

## Success Criteria

The app is successful if a user can answer:

text Which branches are well supported? Which branches are weak? Which weak branches are actually contradicted? Which weak branches are merely uninformative? Which genes/loci/windows support or contradict a branch? Is conflict concentrated in particular loci, chromosomes, partitions, or missing-data classes? What happens if weak branches are collapsed? 

The app should make phylogenetic uncertainty inspectable, not merely decorative.

---

## One-Sentence Product Description

An interactive browser-based “Honest Tree” viewer that keeps a single reference phylogeny visible while letting users switch between support, conflict, evidence-density, histogram, barcode, and lens overlays, with branch-level reports and a linked branch-by-locus conflict matrix.