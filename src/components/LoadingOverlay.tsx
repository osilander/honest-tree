/**
 * Parsing + concordance computation is synchronous and can take 20-30s+ on
 * large datasets (thousands of loci) - there's no reliable way to report
 * real percentage progress without chunking that work across multiple
 * ticks, so this is deliberately an indeterminate bar (motion signals "still
 * working", not "X% done").
 */
export function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <div className="loading-box">
        <p>Loading dataset…</p>
        <p className="dropzone-hint">Parsing trees and computing branch support - large datasets can take a while.</p>
        <div className="progress-track">
          <div className="progress-bar-indeterminate" />
        </div>
      </div>
    </div>
  );
}
