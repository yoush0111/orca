import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  connect,
  disconnect,
  getStatus,
  listIssues,
  listProjects,
  listStatuses,
  testConnection
} from '../redmine/client'
import {
  getRedmineAgentSkillStatus,
  installRedmineAgentSkill
} from '../redmine/agent-skill-install'
import { buildWeeklyReport } from '../redmine/weekly-report'
import { weeklyReportMarkdownToHtml } from '../../shared/redmine-weekly-report-html'
import {
  RedmineWeeklyReportMarkdown,
  RedmineWeeklyReportQuery,
  RedmineWeeklyReportSave
} from '../../shared/rpc-contract/redmine-params'
import type {
  RedmineConnectArgs,
  RedmineIssueQuery,
  RedmineWeeklyReportSaveResult
} from '../../shared/redmine-types'

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

async function saveWeeklyReport(
  parent: BrowserWindow | null,
  args: unknown
): Promise<RedmineWeeklyReportSaveResult> {
  const parsed = RedmineWeeklyReportSave.safeParse(args)
  if (!parsed.success) {
    return { ok: false, error: 'File name and report content are required.' }
  }
  const { markdown, defaultDir } = parsed.data
  // Why: keep the suggested name legal on Windows, which forbids /\:*?"<>| in file names.
  const fileName = parsed.data.fileName.replace(/[/\\:*?"<>|]/g, '_').slice(0, 100) || 'report.md'
  const dir = defaultDir || app.getPath('documents')
  const options = {
    defaultPath: path.join(dir, fileName),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  }
  // The OS dialog already handles overwrite confirmation and folder creation.
  const { canceled, filePath } = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) {
    return { ok: false, canceled: true }
  }
  try {
    await writeFile(filePath, markdown, 'utf8')
    return { ok: true, filePath, directory: path.dirname(filePath) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save the report.'
    }
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

  ipcMain.handle('redmine:weeklyReport', async (_event, args?: unknown) => {
    const parsed = RedmineWeeklyReportQuery.safeParse(args)
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Invalid weekly report range.')
    }
    return buildWeeklyReport(parsed.data)
  })

  // Always local: the report file belongs on the user's machine even with a remote runtime.
  ipcMain.handle('redmine:saveWeeklyReport', async (event, args?: unknown) =>
    saveWeeklyReport(BrowserWindow.fromWebContents(event.sender), args)
  )

  // HTML + plain text: Slack keeps nested lists and links from the HTML flavor.
  ipcMain.handle('redmine:copyWeeklyReportForSlack', async (_event, markdown?: unknown) => {
    const text = RedmineWeeklyReportMarkdown.parse(markdown)
    clipboard.write({ html: weeklyReportMarkdownToHtml(text), text })
  })

  ipcMain.handle('redmine:agentSkillStatus', async () => getRedmineAgentSkillStatus())

  ipcMain.handle('redmine:installAgentSkill', async () => installRedmineAgentSkill())
}
