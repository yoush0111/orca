import { defineMethod } from '../core'
import {
  RedmineConnect,
  RedmineIssueId,
  RedmineIssueNote,
  RedmineIssueQuery,
  RedmineWeeklyReportQuery
} from '../../../../shared/rpc-contract/redmine-params'

export const REDMINE_METHODS = [
  defineMethod({
    name: 'redmine.connect',
    permission: 'accounts-admin',
    params: RedmineConnect,
    handler: async (params, { runtime }) =>
      runtime.redmineConnect({ baseUrl: params.baseUrl.trim(), apiKey: params.apiKey.trim() })
  }),
  defineMethod({
    name: 'redmine.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineDisconnect()
  }),
  defineMethod({
    name: 'redmine.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineStatus()
  }),
  defineMethod({
    name: 'redmine.testConnection',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineTestConnection()
  }),
  defineMethod({
    name: 'redmine.listIssues',
    permission: 'workspace',
    params: RedmineIssueQuery,
    handler: async (params, { runtime }) => runtime.redmineListIssues(params ?? {})
  }),
  defineMethod({
    name: 'redmine.listProjects',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineListProjects()
  }),
  defineMethod({
    name: 'redmine.listStatuses',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.redmineListStatuses()
  }),
  defineMethod({
    name: 'redmine.issueShow',
    permission: 'workspace',
    params: RedmineIssueId,
    handler: async (params, { runtime }) => runtime.redmineIssueShow(params.id)
  }),
  defineMethod({
    name: 'redmine.issueAddNote',
    permission: 'workspace',
    params: RedmineIssueNote,
    handler: async (params, { runtime }) => runtime.redmineIssueAddNote(params.id, params.notes)
  }),
  defineMethod({
    name: 'redmine.weeklyReport',
    permission: 'workspace',
    params: RedmineWeeklyReportQuery,
    handler: async (params, { runtime }) => runtime.redmineWeeklyReport(params)
  })
]
