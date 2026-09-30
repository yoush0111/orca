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
