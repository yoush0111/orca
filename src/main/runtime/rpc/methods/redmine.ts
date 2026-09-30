import { defineMethod } from '../core'
import {
  RedmineConnect,
  RedmineIssueId,
  RedmineIssueNote,
  RedmineIssueQuery
} from '../../../../shared/rpc-contract/redmine-params'

export const REDMINE_METHODS = [
  defineMethod({
    name: 'redmine.connect',
    params: RedmineConnect,
    handler: async (params, { runtime }) =>
      runtime.redmineConnect({ baseUrl: params.baseUrl.trim(), apiKey: params.apiKey.trim() })
  }),
  defineMethod({
    name: 'redmine.disconnect',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineDisconnect()
  }),
  defineMethod({
    name: 'redmine.status',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineStatus()
  }),
  defineMethod({
    name: 'redmine.testConnection',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineTestConnection()
  }),
  defineMethod({
    name: 'redmine.listIssues',
    params: RedmineIssueQuery,
    handler: async (params, { runtime }) => runtime.redmineListIssues(params ?? {})
  }),
  defineMethod({
    name: 'redmine.listProjects',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineListProjects()
  }),
  defineMethod({
    name: 'redmine.listStatuses',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineListStatuses()
  }),
  defineMethod({
    name: 'redmine.issueShow',
    params: RedmineIssueId,
    handler: async (params, { runtime }) => runtime.redmineIssueShow(params.id)
  }),
  defineMethod({
    name: 'redmine.issueAddNote',
    params: RedmineIssueNote,
    handler: async (params, { runtime }) => runtime.redmineIssueAddNote(params.id, params.notes)
  })
]
