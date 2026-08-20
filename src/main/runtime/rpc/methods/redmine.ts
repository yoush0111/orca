import { z } from 'zod'
import { defineMethod, type RpcAnyMethod } from '../core'
import { OptionalFiniteNumber, OptionalString, requiredString } from '../schemas'

const Connect = z.object({
  baseUrl: requiredString('Base URL is required'),
  apiKey: requiredString('API key is required')
})

const IssueQuery = z
  .object({
    mineOnly: z.boolean().optional(),
    projectId: OptionalFiniteNumber,
    statusId: OptionalString,
    limit: OptionalFiniteNumber
  })
  .optional()

export const REDMINE_METHODS: RpcAnyMethod[] = [
  defineMethod({
    name: 'redmine.connect',
    params: Connect,
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
    params: IssueQuery,
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
  })
]
