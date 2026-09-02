import {
  normalizeTaskSourceContext,
  type TaskSourceContext
} from '../../../shared/task-source-context'
import type { ExecutionHostId } from '../../../shared/execution-host'

/** Redmine has no repo of its own, so it falls back to the account-scoped project id. */
export const ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID = 'account-backed-task-source'

export function buildRedmineTaskSourceContext(args: {
  projectId: string
  hostId: ExecutionHostId
  baseUrl: string | null
}): TaskSourceContext | null {
  return normalizeTaskSourceContext({
    provider: 'redmine',
    projectId: args.projectId,
    hostId: args.hostId,
    providerIdentity: { provider: 'redmine', baseUrl: args.baseUrl },
    accountLabel: args.baseUrl
  })
}
