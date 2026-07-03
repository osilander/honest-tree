import { useState } from 'react';
import type { BranchRecord, TaxonInstabilityEntry } from '../types';
import { generateNaturalLanguageReport } from '../report/naturalLanguage';
import { patternLabel, withAltRanks } from '../utils/pattern';
import { EdgeHistogram } from './EdgeHistogram';

function taxaList(taxa: string[], max = 8): string {
  if (taxa.length <= max) return taxa.join(', ');
  return `${taxa.slice(0, max).join(', ')}, +${taxa.length - max} more`;
}

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
    `gCF: ${branch.support.gcf?.toFixed(1)}%`,
    `Decisive loci: ${branch.counts.decisiveLoci}/${branch.counts.totalLoci} (missing: ${branch.counts.missingLoci})`,
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
    '',
    `Side A (${branch.taxaLeft.length}): ${branch.taxaLeft.join(', ')}`,
    `Side B (${branch.taxaRight.length}): ${branch.taxaRight.join(', ')}`,
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
  missingBreakdownOpen,
  onToggleMissingBreakdown,
  isRerootedHere,
  onRerootHere,
  onResetRoot,
}: {
  branch: BranchRecord | null;
  missingBreakdownOpen: boolean;
  onToggleMissingBreakdown: () => void;
  isRerootedHere: boolean;
  onRerootHere: () => void;
  onResetRoot: () => void;
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

  return (
    <div className="evidence-panel">
      <div className="evidence-header">
        <span className="branch-id">{branch.branchId}</span>
        <span className="conflict-badge">{CONFLICT_LABELS[branch.dominantConflict] ?? branch.dominantConflict}</span>
      </div>

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
              <td>gCF (simplified)</td>
              <td>{branch.support.gcf?.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h4>Edge histogram</h4>
        <EdgeHistogram branch={branch} />
      </section>

      {branch.taxonInstability.length > 0 && (
        <section>
          <h4>Most unstable taxa around this branch</h4>
          <ul className="instability-list">
            {branch.taxonInstability.slice(0, 5).map((t) => (
              <li key={t.taxon}>
                <strong>{t.taxon}</strong>: {describeInstability(t)}
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
          </tbody>
        </table>
        {missingBreakdownOpen && missingTaxa.length > 0 && (
          <ul className="instability-list missing-breakdown">
            {missingTaxa.slice(0, 8).map((t) => (
              <li key={t.taxon}>
                {t.taxon}: absent in {t.missingCount} loci ({(t.missingShare * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Taxa</h4>
        <p className="taxa-side">
          <strong>Side A</strong> ({branch.taxaLeft.length}): {taxaList(branch.taxaLeft)}
        </p>
        <p className="taxa-side">
          <strong>Side B</strong> ({branch.taxaRight.length}): {taxaList(branch.taxaRight)}
        </p>
      </section>

      <section>
        <h4>Support provenance</h4>
        <p className="provenance-empty">No provenance metadata available.</p>
      </section>
    </div>
  );
}
