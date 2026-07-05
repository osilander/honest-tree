import type { RenderMode } from '../types';
import { CONFLICT_COLORS, EVIDENCE_GREY, EVIDENCE_GREY_CUTOFF, EVIDENCE_HIGH_COLOR, EVIDENCE_LOW_COLOR, NEUTRAL_BRANCH } from '../utils/color';

const CONFLICT_ROWS: { key: keyof typeof CONFLICT_COLORS; label: string; desc: string }[] = [
  { key: 'low_conflict', label: 'Low conflict', desc: 'Reference split well supported, little to no conflict' },
  { key: 'concentrated', label: 'Concentrated', desc: 'One specific alternative topology dominates the conflict' },
  { key: 'contradicted', label: 'Contradicted', desc: 'An alternative topology is more common than the reference' },
  { key: 'diffuse', label: 'Diffuse', desc: 'Conflict spread thinly across many alternatives, none dominant' },
  { key: 'missing_data', label: 'Missing data', desc: 'Too few decisive loci to classify this branch at all' },
];

export function TreeLegend({ renderMode }: { renderMode: RenderMode }) {
  if (renderMode === 'conflict') {
    return (
      <div className="tree-legend">
        <p className="dropzone-hint">
          <strong>Width</strong>: amount of discordance among decisive loci (thicker = more conflicting). <strong>Color</strong>: kind of
          conflict.
        </p>
        {CONFLICT_ROWS.map((r) => (
          <div key={r.key} className="legend-item" title={r.desc}>
            <span className="legend-swatch" style={{ background: CONFLICT_COLORS[r.key] }} />
            <strong>{r.label}</strong> - {r.desc}
          </div>
        ))}
      </div>
    );
  }

  if (renderMode === 'evidence') {
    return (
      <div className="tree-legend">
        <p className="dropzone-hint">
          <strong>Width and color</strong> both track how much usable evidence this branch has, independent of what it says.
        </p>
        <div className="tree-legend-gradient" style={{ background: `linear-gradient(90deg, ${EVIDENCE_LOW_COLOR}, ${EVIDENCE_HIGH_COLOR})` }} />
        <div className="tree-legend-gradient-labels">
          <span>Mostly uninformative/missing</span>
          <span>Mostly decisive</span>
        </div>
        <div className="legend-item" title={`Below ~${Math.round(EVIDENCE_GREY_CUTOFF * 100)}% decisive loci - a qualitatively different state, not just a further step down the gradient.`}>
          <span className="legend-swatch" style={{ background: EVIDENCE_GREY }} />
          <strong>Grey</strong> - almost no usable data at all
        </div>
      </div>
    );
  }

  return (
    <div className="tree-legend">
      <p className="dropzone-hint">
        <strong>Width</strong>: Clade recovery value (thicker = more strongly supported). Color is neutral in this mode - it doesn't encode
        anything.
      </p>
      <div className="legend-item">
        <span className="legend-swatch" style={{ background: NEUTRAL_BRANCH }} />
        All branches, regardless of support value
      </div>
      <p className="dropzone-hint">In every mode, fainter (more transparent) branches have fewer decisive loci relative to the total.</p>
    </div>
  );
}
