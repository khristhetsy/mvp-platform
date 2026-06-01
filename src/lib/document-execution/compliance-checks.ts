export function isExecutionBlockedByCompliance(criticalOpenCount: number): boolean {
  return criticalOpenCount > 0;
}

export function complianceBlockReason(criticalOpenCount: number): string | null {
  if (criticalOpenCount <= 0) return null;
  return `${criticalOpenCount} critical compliance event(s) open — resolve before document execution.`;
}
