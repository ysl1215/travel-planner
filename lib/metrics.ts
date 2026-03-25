export const metrics: Record<string, number> = {
  lookupFailures: 0,
  fallbackUsed: 0,
  travelLimitErrors: 0,
};

export function incrementMetric(key: keyof typeof metrics, n = 1) {
  if (!Object.prototype.hasOwnProperty.call(metrics, key)) return;
  metrics[key] += n;
}

export function snapshotMetrics() {
  return { ...metrics };
}
