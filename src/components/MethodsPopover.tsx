import { useState } from 'react';

export function MethodsPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="methods-popover-container">
      <button className="methods-info-button" onClick={() => setOpen((v) => !v)} title="What do these numbers mean?" aria-label="Methods">
        ⓘ Methods
      </button>
      {open && (
        <>
          <div className="methods-popover-backdrop" onClick={() => setOpen(false)} />
          <div className="methods-popover">
            <div className="methods-popover-header">
              <strong>Methods</strong>
              <button className="methods-popover-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="methods-popover-body">
              <dl>
                <dt>Reference tree</dt>
                <dd>
                  By default, a greedy compatible-splits consensus from your input gene trees - not a Bayesian posterior summary, not
                  species-tree inference. I.e. no population-/species-level model of <em>why</em> trees disagree (e.g. incomplete lineage
                  sorting) - just a frequency tally, so it can't recover cases where the true species tree differs from the most common gene
                  tree topology (the "anomaly zone"). You can instead supply your own reference tree (e.g. a proper species-tree estimate) when
                  loading data - every branch is then evaluated against that tree instead.
                </dd>

                <dt>Clade recovery</dt>
                <dd>% of decisive loci where this exact clade is recovered. Not the formal quartet-based gCF statistic.</dd>

                <dt>Missing vs. uninformative</dt>
                <dd>
                  <em>Missing</em>: too few of this branch's taxa are present in that locus to test it. <em>Uninformative</em>: the taxa are all
                  present, but that locus doesn't clearly support the reference or any specific alternative.
                </dd>

                <dt>Branch lengths</dt>
                <dd>Averaged per branch from whichever gene trees give a usable reading. Hover a branch to see exact vs. fallback observations.</dd>

                <dt>Not yet implemented</dt>
                <dd>Bootstrap support, posterior probability, true quartet-based gCF.</dd>
              </dl>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
