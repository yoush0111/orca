import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID,
  buildRedmineTaskSourceContext
} from './redmine-task-source-context'

describe('buildRedmineTaskSourceContext', () => {
  it('carries the Redmine base URL into both the provider identity and the account label', () => {
    const context = buildRedmineTaskSourceContext({
      projectId: 'github:owner/repo',
      hostId: 'local',
      baseUrl: 'https://redmine.example.com'
    })

    expect(context).toMatchObject({
      kind: 'task-source',
      provider: 'redmine',
      projectId: 'github:owner/repo',
      hostId: 'local',
      providerIdentity: { provider: 'redmine', baseUrl: 'https://redmine.example.com' },
      accountLabel: 'https://redmine.example.com'
    })
  })

  it('still builds a context when Redmine is not connected yet', () => {
    const context = buildRedmineTaskSourceContext({
      projectId: ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID,
      hostId: 'local',
      baseUrl: null
    })

    expect(context?.projectId).toBe(ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID)
    expect(context?.accountLabel).toBeFalsy()
  })

  it('returns null for an empty project id because a context without one is unusable', () => {
    expect(
      buildRedmineTaskSourceContext({ projectId: '', hostId: 'local', baseUrl: null })
    ).toBeNull()
  })
})
