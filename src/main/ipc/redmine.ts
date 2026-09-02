import { ipcMain } from 'electron'
import {
  connect,
  disconnect,
  getStatus,
  listIssues,
  listProjects,
  listStatuses,
  testConnection
} from '../redmine/client'
import type { RedmineConnectArgs, RedmineIssueQuery } from '../../shared/redmine-types'

function normalizeQuery(value: unknown): RedmineIssueQuery {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const raw = value as Record<string, unknown>
  return {
    mineOnly: raw.mineOnly === true,
    projectId: typeof raw.projectId === 'number' ? raw.projectId : null,
    statusId: typeof raw.statusId === 'string' ? raw.statusId : undefined,
    limit: typeof raw.limit === 'number' ? raw.limit : undefined
  }
}

export function registerRedmineHandlers(): void {
  ipcMain.handle('redmine:connect', async (_event, args: RedmineConnectArgs) => {
    if (typeof args?.baseUrl !== 'string' || typeof args?.apiKey !== 'string') {
      return { ok: false, error: 'Base URL and API key are required.' }
    }
    return connect({ baseUrl: args.baseUrl, apiKey: args.apiKey })
  })

  ipcMain.handle('redmine:disconnect', async () => {
    disconnect()
  })

  ipcMain.handle('redmine:status', async () => getStatus())

  ipcMain.handle('redmine:testConnection', async () => testConnection())

  ipcMain.handle('redmine:listIssues', async (_event, args?: unknown) =>
    listIssues(normalizeQuery(args))
  )

  ipcMain.handle('redmine:listProjects', async () => listProjects())

  ipcMain.handle('redmine:listStatuses', async () => listStatuses())
}
