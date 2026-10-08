import type { GlobalSettings } from '../../../shared/global-settings-types'
import {
  getTaskSourceRuntimeSettings,
  type TaskSourceContext
} from '../../../shared/task-source-context'
import type {
  RedmineConnectArgs,
  RedmineConnectResult,
  RedmineConnectionStatus,
  RedmineIssue,
  RedmineIssueQuery,
  RedmineNamedRef,
  RedmineProject,
  RedmineWeeklyReportQuery,
  RedmineWeeklyReportResult
} from '../../../shared/redmine-types'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc, getActiveRuntimeTarget, RuntimeRpcCallError } from './runtime-rpc-client'

export type RuntimeRedmineSettings =
  | Pick<GlobalSettings, 'activeRuntimeEnvironmentId'>
  | TaskSourceContext
  | null
  | undefined

export const DISCONNECTED_REDMINE_STATUS: RedmineConnectionStatus = {
  connected: false,
  connection: null
}

function getRedmineRuntimeTarget(
  settings: RuntimeRedmineSettings
): ReturnType<typeof getActiveRuntimeTarget> {
  const isTaskSource = settings !== null && settings !== undefined && 'kind' in settings
  return getActiveRuntimeTarget(
    isTaskSource ? getTaskSourceRuntimeSettings(settings as TaskSourceContext) : settings
  )
}

// Why: a remote runtime older than Redmine support answers `method_not_found`.
// That is "this host cannot serve Redmine", not a failure worth surfacing.
function isMethodNotFound(error: unknown): boolean {
  return error instanceof RuntimeRpcCallError && error.code === 'method_not_found'
}

export async function redmineStatus(
  settings: RuntimeRedmineSettings
): Promise<RedmineConnectionStatus> {
  const target = getRedmineRuntimeTarget(settings)
  if (target.kind !== 'environment') {
    return window.api.redmine.status()
  }
  try {
    return await callRuntimeRpc<RedmineConnectionStatus>(target, 'redmine.status', undefined, {
      timeoutMs: 15_000
    })
  } catch (error) {
    if (isMethodNotFound(error)) {
      return DISCONNECTED_REDMINE_STATUS
    }
    throw error
  }
}

export async function redmineConnect(
  settings: RuntimeRedmineSettings,
  args: RedmineConnectArgs
): Promise<RedmineConnectResult> {
  const target = getRedmineRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<RedmineConnectResult>(target, 'redmine.connect', args, { timeoutMs: 30_000 })
    : window.api.redmine.connect(args)
}

export async function redmineDisconnect(settings: RuntimeRedmineSettings): Promise<void> {
  const target = getRedmineRuntimeTarget(settings)
  if (target.kind === 'environment') {
    await callRuntimeRpc<{ ok: true }>(target, 'redmine.disconnect', undefined, {
      timeoutMs: 15_000
    })
    return
  }
  await window.api.redmine.disconnect()
}

export async function redmineTestConnection(
  settings: RuntimeRedmineSettings
): Promise<RedmineConnectResult> {
  const target = getRedmineRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<RedmineConnectResult>(target, 'redmine.testConnection', undefined, {
        timeoutMs: 30_000
      })
    : window.api.redmine.testConnection()
}

export async function redmineListIssues(
  settings: RuntimeRedmineSettings,
  query: RedmineIssueQuery
): Promise<RedmineIssue[]> {
  const target = getRedmineRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<RedmineIssue[]>(target, 'redmine.listIssues', query, { timeoutMs: 30_000 })
    : window.api.redmine.listIssues(query)
}

export async function redmineListProjects(
  settings: RuntimeRedmineSettings
): Promise<RedmineProject[]> {
  const target = getRedmineRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<RedmineProject[]>(target, 'redmine.listProjects', undefined, {
        timeoutMs: 30_000
      })
    : window.api.redmine.listProjects()
}

export async function redmineListStatuses(
  settings: RuntimeRedmineSettings
): Promise<RedmineNamedRef[]> {
  const target = getRedmineRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<RedmineNamedRef[]>(target, 'redmine.listStatuses', undefined, {
        timeoutMs: 30_000
      })
    : window.api.redmine.listStatuses()
}

export async function redmineWeeklyReport(
  settings: RuntimeRedmineSettings,
  query: RedmineWeeklyReportQuery
): Promise<RedmineWeeklyReportResult> {
  const target = getRedmineRuntimeTarget(settings)
  if (target.kind !== 'environment') {
    return window.api.redmine.weeklyReport(query)
  }
  try {
    // One request per issue fans out on the host, so allow far more than a list read.
    return await callRuntimeRpc<RedmineWeeklyReportResult>(target, 'redmine.weeklyReport', query, {
      timeoutMs: 120_000
    })
  } catch (error) {
    if (isMethodNotFound(error)) {
      throw new Error(
        translate(
          'auto.runtime.runtimeRedmineClient.weeklyReportUnsupported',
          'The connected host does not support weekly reports. Update the host.'
        )
      )
    }
    throw error
  }
}
