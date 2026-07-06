import { useState } from 'react';
import type { BranchRecord, Dataset, TaxonInstabilityEntry } from '../types';
import { generateNaturalLanguageReport } from '../report/naturalLanguage';
import { patternLabel, withAltRanks } from '../utils/pattern';
import { CategoryTopologyBreakdown } from './CategoryTopologyBreakdown';
import { EdgeHistogram } from './EdgeHistogram';

function describeInstability(entry: TaxonInstabilityEntry): string {
  if (entry.missingShare >= 0.5 && entry.missingShare > entry.conflictShare) {
    return `mostly missing (${(entry.missingShare * 100).toFixed(0)}% of loci)`;
  }
  const parts: string[] = [];
  if (entry.conflictShare > 0) parts.push(`appears in ${(entry.conflictShare * 100).toFixed(0)}% of conflicting loci`);
  if (entry.missingShare >= 0.15) parts.push(`missing in ${(entry.missingShare * 100).toFixed(0)}% of loci`);
  return parts.join(', ') || 'no notable instability';
}

function buildCopyText(branch: BranchRecord): string {
  const lines = [
    `Branch ${branch.branchId} (${branch.splitId})`,
    `Dominant conflict: ${branch.dominantConflict}`,
    '',
    generateNaturalLanguageReport(branch),
    '',
    `Clade recovery: ${branch.support.gcf?.toFixed(1)}%`,
    `Decisive loci: ${branch.counts.decisiveLoci}/${branch.counts.totalLoci} (missing: ${branch.counts.missingLoci}, uninformative: ${branch.counts.uninformativeLoci})`,
    '',
    'Topology patterns:',
    ...withAltRanks(branch.topologyPatterns)
      .filter(({ pattern }) => pattern.count > 0)
      .flatMap(({ pattern, altRank }) => {
        const line = `  ${pattern.count} (${((pattern.count / branch.counts.totalLoci) * 100).toFixed(1)}%) - ${patternLabel(branch, pattern, altRank)}`;
        return pattern.refLocalSplit && pattern.altLocalSplit
          ? [line, `      local: ${pattern.refLocalSplit} -> ${pattern.altLocalSplit}`]
          : [line];
      }),
    '',
    'Most unstable taxa:',
    ...branch.taxonInstability.slice(0, 5).map((t) => `  ${t.taxon}: ${describeInstability(t)}`),
  ];
  return lines.join('\n');
}

const CONFLICT_LABELS: Record<string, string> = {
  low_conflict: 'Low conflict',
  concentrated: 'Concentrated conflict',
  contradicted: 'Contradicted by an alternative',
  diffuse: 'Diffuse conflict',
  missing_data: 'Missing data',
  none: 'None',
};

export function BranchEvidencePanel({
  branch,
  dataset,
  metadataColumn,
  missingBreakdownOpen,
  onToggleMissingBreakdown,
  isRerootedHere,
  onRerootHere,
  onResetRoot,
  visibleTaxa,
}: {
  branch: BranchRecord | null;
  dataset: Dataset | null;
  metadataColumn: string | null;
  missingBreakdownOpen: boolean;
  onToggleMissingBreakdown: () => void;
  isRerootedHere: boolean;
  onRerootHere: () => void;
  onResetRoot: () => void;
  visibleTaxa: string[] | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!branch) {
    return (
      <div className="evidence-panel">
        <p className="evidence-instruction">Select a branch to inspect support, conflict, and locus-level evidence.</p>
      </div>
    );
  }

  const missingTaxa = branch.taxonInstability.filter((t) => t.missingCount > 0).sort((a, b) => b.missingShare - a.missingShare);
  const hiddenCount = dataset && visibleTaxa ? dataset.taxa.length - visibleTaxa.length : 0;
  const visibleSet = visibleTaxa ? new Set(visibleTaxa) : null;

  return (
    <div className="evidence-panel">
      <div className="evidence-header">
        <span className="branch-id">{branch.branchId}</span>
        <span className="conflict-badge">{CONFLICT_LABELS[branch.dominantConflict] ?? branch.dominantConflict}</span>
      </div>

      {hiddenCount > 0 && (
        <p className="sampling-caveat">
          Taxon sampler is showing {visibleTaxa!.length} of {dataset!.taxa.length} taxa. Everything below (support, conflict, wandering
          taxa) is computed from the full taxon set, not just what's currently displayed - taxa marked <em>(hidden)</em> aren't in the
          current view.
        </p>
      )}

      <section>
        <div className="section-header-row">
          <h4>Report</h4>
          <div className="header-btn-row">
            {isRerootedHere ? (
              <button className="copy-report-btn" onClick={onResetRoot}>
                Reset root
              </button>
            ) : (
              <button className="copy-report-btn" onClick={onRerootHere}>
                Re-root here
              </button>
            )}
            <button
              className="copy-report-btn"
              onClick={() => {
                navigator.clipboard.writeText(buildCopyText(branch));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied!' : 'Copy branch report'}
            </button>
          </div>
        </div>
        <p className="nl-report">{generateNaturalLanguageReport(branch)}</p>
      </section>

      <section>
        <h4>Support</h4>
        <table className="metrics-table">
          <tbody>
            <tr>
              <td title="Fraction of decisive loci in which this exact reference clade is recovered. This is clade/split recovery, not the formal quartet-based gCF statistic.">
                Clade recovery
              </td>
              <td>{branch.support.gcf?.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h4>Edge histogram</h4>
        <EdgeHistogram branch={branch} />
      </section>

      {dataset &&
        metadataColumn &&
        dataset.locusMetadataTable?.columns.find((c) => c.name === metadataColumn)?.kind === 'categorical' && (
          <section>
            <h4>Topology by {metadataColumn}</h4>
            <CategoryTopologyBreakdown dataset={dataset} branch={branch} column={metadataColumn} />
          </section>
        )}

      {branch.taxonInstability.length > 0 && (
        <section>
          <h4>Most unstable taxa around this branch</h4>
          <ul className="instability-list">
            {branch.taxonInstability.slice(0, 5).map((t) => (
              <li key={t.taxon}>
                <strong>{t.taxon}</strong>: {describeInstability(t)}
                {visibleSet && !visibleSet.has(t.taxon) && <em className="hidden-taxon-tag"> (hidden)</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4>Raw counts</h4>
        <table className="metrics-table">
          <tbody>
            <tr>
              <td>Total loci</td>
              <td>{branch.counts.totalLoci}</td>
            </tr>
            <tr>
              <td>Decisive loci</td>
              <td>{branch.counts.decisiveLoci}</td>
            </tr>
            <tr>
              <td>
                <button className="expand-toggle" onClick={onToggleMissingBreakdown} disabled={missingTaxa.length === 0}>
                  {missingBreakdownOpen ? '▾' : '▸'} Missing
                </button>
              </td>
              <td>{branch.counts.missingLoci}</td>
            </tr>
            <tr>
              <td title="Relevant taxa are present, but this locus's placement of them doesn't align with the reference or any identifiable alternative - no coherent signal either way.">
                Uninformative
              </td>
              <td>{branch.counts.uninformativeLoci}</td>
            </tr>
          </tbody>
        </table>
        {missingBreakdownOpen && missingTaxa.length > 0 && (
          <ul className="instability-list missing-breakdown">
            {missingTaxa.slice(0, 8).map((t) => (
              <li key={t.taxon}>
                {t.taxon}: absent in {t.missingCount} loci ({(t.missingShare * 100).toFixed(0)}%)
                {visibleSet && !visibleSet.has(t.taxon) && <em className="hidden-taxon-tag"> (hidden)</em>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Support provenance</h4>
        <p className="provenance-empty">No provenance metadata available.</p>
      </section>
    </div>
  );
}
