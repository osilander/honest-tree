import type { SupportMetrics, SupportMetricKey } from '../types';

/** Returns the chosen support metric as a 0-100 percentage, with a sensible fallback. */
export function getSupportMetricValue(support: SupportMetrics, metric: SupportMetricKey): number {
  switch (metric) {
    case 'gcf':
      return support.gcf ?? support.concordantProportion * 100;
    case 'bootstrap':
      return support.bootstrap ?? support.concordantProportion * 100;
    case 'posterior':
      return support.posterior !== undefined ? support.posterior * 100 : support.concordantProportion * 100;
    case 'concordantProportion':
      return support.concordantProportion * 100;
    default:
      return support.concordantProportion * 100;
  }
}
