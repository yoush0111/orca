import type { RedmineConnectArgs, RedmineIssueQuery } from '../../shared/redmine-types'
import {
  addIssueNote,
  connect,
  disconnect,
  getIssue,
  getStatus,
  listIssues,
  listProjects,
  listStatuses,
  testConnection
} from '../redmine/client'

export class RuntimeRedmineCommands {
  redmineConnect(args: RedmineConnectArgs): ReturnType<typeof connect> {
    return connect(args)
  }

  redmineDisconnect(): { ok: true } {
    disconnect()
    return { ok: true }
  }

  redmineStatus(): ReturnType<typeof getStatus> {
    return getStatus()
  }

  redmineTestConnection(): ReturnType<typeof testConnection> {
    return testConnection()
  }

  redmineListIssues(query: RedmineIssueQuery): ReturnType<typeof listIssues> {
    return listIssues(query)
  }

  redmineListProjects(): ReturnType<typeof listProjects> {
    return listProjects()
  }

  redmineListStatuses(): ReturnType<typeof listStatuses> {
    return listStatuses()
  }

  redmineIssueShow(id: number): ReturnType<typeof getIssue> {
    return getIssue(id)
  }

  async redmineIssueAddNote(id: number, notes: string): Promise<{ ok: true; id: number }> {
    await addIssueNote(id, notes)
    return { ok: true, id }
  }
}
