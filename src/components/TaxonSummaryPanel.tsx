import type { Dataset } from '../types';
import { normalizeTaxonQuery } from '../utils/search';

function resolveTaxon(query: string, taxa: string[]): string | null {
  const q = normalizeTaxonQuery(query);
  if (!q) return null;
  const exact = taxa.find((t) => normalizeTaxonQuery(t) === q);
  if (exact) return exact;
  const matches = taxa.filter((t) => normalizeTaxonQuery(t).includes(q));
  return matches.length === 1 ? matches[0] : null;
}

export function TaxonSummaryPanel({
  dataset,
  query,
  onSelectBranch,
}: {
  dataset: Dataset;
  query: string;
  onSelectBranch: (splitId: string) => void;
}) {
  const taxon = resolveTaxon(query, dataset.taxa);

  if (!taxon) {
    const q = normalizeTaxonQuery(query);
    const partial = q.length >= 2 ? dataset.taxa.filter((t) => normalizeTaxonQuery(t).includes(q)) : [];
    return (
      <div className="evidence-panel">
        <p className="evidence-instruction">
          {partial.length > 1
            ? `${partial.length} taxa match "${query}" - keep typing to narrow it down.`
            : q.length >= 2
              ? `No taxon matches "${query}".`
              : 'Select a branch, or search a taxon name above.'}
        </p>
      </div>
    );
  }

  const involved: { splitId: string; branchId: string; conflictShare: number; missingShare: number }[] = [];
  let totalConflict = 0;
  let totalMissing = 0;
  for (const branch of dataset.branches.values()) {
    const entry = branch.taxonInstability.find((t) => t.taxon === taxon);
    if (entry && (entry.conflictCount > 0 || entry.missingCount > 0)) {
      involved.push({ splitId: branch.splitId, branchId: branch.branchId, conflictShare: entry.conflictShare, missingShare: entry.missingShare });
      totalConflict += entry.conflictCount;
      totalMissing += entry.missingCount;
    }
  }
  involved.sort((a, b) => b.conflictShare + b.missingShare - (a.conflictShare + a.missingShare));

  return (
    <div className="evidence-panel">
      <div className="evidence-header">
        <span className="branch-id">{taxon}</span>
      </div>
      <section>
        <h4>Taxon instability</h4>
        <p className="nl-report">
          {involved.length === 0
            ? `${taxon} is not a notable source of conflict or missingness at any branch.`
            : `${taxon} shows up as an unstable/wandering taxon at ${involved.length} branch${involved.length === 1 ? '' : 'es'}, contributing to ${totalConflict} conflicting locus classifications and ${totalMissing} missing-taxon classifications in total.`}
        </p>
      </section>
      {involved.length > 0 && (
        <section>
          <h4>Branches affected (click to inspect)</h4>
          <ul className="instability-list">
            {involved.slice(0, 15).map((b) => (
              <li key={b.splitId}>
                <button className="taxon-branch-link" onClick={() => onSelectBranch(b.splitId)}>
                  {b.branchId}
                </button>
                {b.conflictShare > 0 && ` - conflict in ${(b.conflictShare * 100).toFixed(0)}% of conflicting loci`}
                {b.missingShare >= 0.15 && ` - missing in ${(b.missingShare * 100).toFixed(0)}% of loci`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
