export const routeMaxDurationSeconds = 300;
export const routeMaxDurationMs = routeMaxDurationSeconds * 1000;
export const defaultWorkflowTimeoutMs = 240_000;
export const maxWorkflowTimeoutMs = 240_000;
export const finalizationReserveMs = 15_000;

export type ExecutionBudget = {
  startedAt: number;
  workflowTimeoutMs: number;
  providerTimeoutMs: number;
  finalizationReserveMs: number;
  deadlineAt: number;
  providerTimeoutMessage: string;
};

export function createExecutionBudget(
  startedAt: number,
  requestedTimeoutMs = defaultWorkflowTimeoutMs,
): ExecutionBudget {
  const workflowTimeoutMs = Math.min(requestedTimeoutMs, maxWorkflowTimeoutMs);
  const reserve =
    workflowTimeoutMs < 10_000
      ? 0
      : Math.min(finalizationReserveMs, Math.floor(workflowTimeoutMs * 0.1));
  const providerTimeoutMs = workflowTimeoutMs - reserve;

  return {
    startedAt,
    workflowTimeoutMs,
    providerTimeoutMs,
    finalizationReserveMs: reserve,
    deadlineAt: startedAt + workflowTimeoutMs,
    providerTimeoutMessage: [
      `Provider call exceeded its ${providerTimeoutMs}ms budget.`,
      `The full workflow budget is ${workflowTimeoutMs}ms,`,
      `with ${reserve}ms reserved for final writes and notifications.`,
    ].join(" "),
  };
}
