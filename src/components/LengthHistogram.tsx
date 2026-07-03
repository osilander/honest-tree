import type { LengthObservation } from '../types';
import { MAIN_PATTERN_COLOR, NEUTRAL_BRANCH } from '../utils/color';

const BINS = 12;
const WIDTH = 120;
const HEIGHT = 34;

function buildBins(observations: LengthObservation[]) {
  const lengths = observations.map((o) => o.length);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const range = max - min || 1;
  const exact = new Array(BINS).fill(0);
  const fallback = new Array(BINS).fill(0);
  for (const o of observations) {
    let idx = Math.floor(((o.length - min) / range) * BINS);
    if (idx >= BINS) idx = BINS - 1;
    if (idx < 0) idx = 0;
    (o.exact ? exact : fallback)[idx]++;
  }
  return { exact, fallback, min, max };
}

/**
 * Where a branch's averaged length actually came from: exact readings (this
 * gene tree displayed the branch's precise clade) stack separately from
 * fallback readings (a coarser enclosing clade stood in for it) so the two
 * very different kinds of evidence never look like one clean distribution.
 */
export function LengthHistogram({ observations }: { observations: LengthObservation[] }) {
  if (observations.length === 0) return null;
  const { exact, fallback, min, max } = buildBins(observations);
  const maxBinTotal = Math.max(1, ...exact.map((e, i) => e + fallback[i]));
  const barWidth = WIDTH / BINS;
  const exactCount = observations.filter((o) => o.exact).length;

  return (
    <div className="length-histogram">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}>
        {exact.map((exactCountBin, i) => {
          const fallbackCountBin = fallback[i];
          const total = exactCountBin + fallbackCountBin;
          if (total === 0) return null;
          const fallbackHeight = (fallbackCountBin / maxBinTotal) * HEIGHT;
          const exactHeight = (exactCountBin / maxBinTotal) * HEIGHT;
          const x = i * barWidth;
          return (
            <g key={i}>
              {fallbackHeight > 0 && (
                <rect x={x + 0.5} y={HEIGHT - fallbackHeight} width={barWidth - 1} height={fallbackHeight} fill={NEUTRAL_BRANCH} />
              )}
              {exactHeight > 0 && (
                <rect
                  x={x + 0.5}
                  y={HEIGHT - fallbackHeight - exactHeight}
                  width={barWidth - 1}
                  height={exactHeight}
                  fill={MAIN_PATTERN_COLOR}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="length-histogram-legend">
        <span>
          <span className="legend-swatch" style={{ background: MAIN_PATTERN_COLOR }} /> exact ({exactCount})
        </span>
        <span>
          <span className="legend-swatch" style={{ background: NEUTRAL_BRANCH }} /> fallback ({observations.length - exactCount})
        </span>
      </div>
      <div className="length-histogram-range">
        {min.toFixed(4)} – {max.toFixed(4)}
      </div>
    </div>
  );
}
