import type { RenderMode } from '../types';
import {
  CONFLICT_HIGH_COLOR,
  CONFLICT_LOW_COLOR,
  CONFLICT_MISSING_DATA_COLOR,
  EVIDENCE_GREY,
  EVIDENCE_GREY_CUTOFF,
  EVIDENCE_HIGH_COLOR,
  EVIDENCE_LOW_COLOR,
  NEUTRAL_BRANCH,
} from '../utils/color';

export function TreeLegend({ renderMode }: { renderMode: RenderMode }) {
  if (renderMode === 'conflict') {
    return (
      <div className="tree-legend">
        <p className="dropzone-hint">
          <strong>Width and color</strong> both track the amount of discordance among decisive loci - thicker and darker red means more
          decisive loci disagree with the reference.
        </p>
        <div className="tree-legend-gradient" style={{ background: `linear-gradient(90deg, ${CONFLICT_LOW_COLOR}, ${CONFLICT_HIGH_COLOR})` }} />
        <div className="tree-legend-gradient-labels">
          <span>No conflict</span>
          <span>Severe conflict</span>
        </div>
        <div className="legend-item" title="Too few decisive loci to assess conflict at all - not a point on the severity scale.">
          <span className="legend-swatch" style={{ background: CONFLICT_MISSING_DATA_COLOR }} />
          <strong>Grey</strong> - too few decisive loci to assess conflict at all
        </div>
        <p className="dropzone-hint">
          Click a branch for its specific conflict pattern - concentrated in one alternative, contradicted by a more common one, or diffuse
          across many.
        </p>
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
