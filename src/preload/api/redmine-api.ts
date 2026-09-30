import type {
  RedmineAgentSkillStatus,
  RedmineConnectArgs,
  RedmineConnectResult,
  RedmineConnectionStatus,
  RedmineIssue,
  RedmineIssueQuery,
  RedmineNamedRef,
  RedmineProject
} from '../../shared/redmine-types'

export type RedmineApi = {
  connect: (args: RedmineConnectArgs) => Promise<RedmineConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<RedmineConnectionStatus>
  testConnection: () => Promise<RedmineConnectResult>
  listIssues: (args?: RedmineIssueQuery) => Promise<RedmineIssue[]>
  listProjects: () => Promise<RedmineProject[]>
  listStatuses: () => Promise<RedmineNamedRef[]>
  agentSkillStatus: () => Promise<RedmineAgentSkillStatus>
  installAgentSkill: () => Promise<RedmineAgentSkillStatus>
}
