// Redmine REST shapes Orca actually renders. The launcher this port follows
// only ever needed issues/projects/statuses, so the surface stays that narrow.

export type RedmineNamedRef = {
  id: number
  name: string
}

export type RedmineProject = {
  id: number
  name: string
  identifier: string
  /** Present for subprojects; drives repo-mapping inheritance. */
  parent?: RedmineNamedRef | null
}

export type RedmineIssue = {
  id: number
  subject: string
  description?: string
  doneRatio: number
  project: RedmineNamedRef | null
  status: RedmineNamedRef | null
  assignedTo: RedmineNamedRef | null
  updatedAt?: string
  url: string
}

export type RedmineViewer = {
  id: number
  login: string
  displayName: string
  email: string | null
}

export type RedmineConnection = {
  baseUrl: string
  viewer: RedmineViewer
}

export type RedmineConnectionStatus = {
  connected: boolean
  connection: RedmineConnection | null
  // Set when a stored key file exists but could not be decrypted, so the UI can
  // explain failing reads while the connection still looks saved.
  credentialError?: string
}

export type RedmineConnectArgs = {
  baseUrl: string
  apiKey: string
}

/** Redmine's own filter vocabulary: `open`/`closed`/`*` or a numeric status id. */
export type RedmineStatusFilter = string

export type RedmineIssueQuery = {
  mineOnly?: boolean
  projectId?: number | null
  statusId?: RedmineStatusFilter
  limit?: number
}

export type RedmineConnectResult =
  | { ok: true; viewer: RedmineViewer }
  | { ok: false; error: string }

export type RedmineIssueJournal = {
  id: number
  author: string | null
  createdAt: string
  notes: string
}

export type RedmineIssueAttachment = {
  filename: string
  filesize: number
  url: string
}

export type RedmineIssueDetail = RedmineIssue & {
  tracker: RedmineNamedRef | null
  journals: RedmineIssueJournal[]
  attachments: RedmineIssueAttachment[]
}

export type RedmineAgentSkillStatus = 'missing' | 'outdated' | 'installed'

export type RedmineWeeklyReportQuery = {
  /** UTC ISO, inclusive. */
  since: string
  /** UTC ISO, exclusive. */
  until: string
  /** Viewer's offset for date labels; a remote runtime's own timezone is irrelevant. */
  utcOffsetMinutes: number
  /** "Developer" user custom field; passed per request because a remote host cannot read client settings. */
  developerFieldId?: number
}

export type RedmineWeeklyReportResult = {
  markdown: string
  issueCount: number
  /** Issues skipped on 403/404; the report still renders. */
  skippedIssueIds: number[]
}

export type RedmineWeeklyReportSaveArgs = {
  fileName: string
  markdown: string
  defaultDir?: string
}

export type RedmineWeeklyReportSaveResult =
  | { ok: true; filePath: string; directory: string }
  | { ok: false; canceled: true }
  | { ok: false; canceled?: false; error: string }

// Lives here, not in global-settings-types.ts, which is at its line budget.
export type RedmineSettings = {
  /** Default-on: Redmine issue links open as a Floating Workspace browser tab instead of a tab in the active worktree. Requires floatingTerminalEnabled. Readers treat absent as on. */
  redmineLinksOpenInFloatingWorkspace?: boolean
  /** Redmine project id -> repo id for the composer's repo default; unmapped projects keep the active-repo fallback. */
  redmineProjectRepoMap?: Record<string, string>
  /** Redmine "developer" user custom field id for the weekly report; unset skips that query. */
  redmineDeveloperFieldId?: number
  /** Last folder a weekly report was saved to; the next save dialog opens there. */
  redmineWeeklyReportDir?: string
  /** Same one-shot guard as the Jira flag, for the later Redmine provider. */
  visibleTaskProvidersDefaultedForRedmine: boolean
}
