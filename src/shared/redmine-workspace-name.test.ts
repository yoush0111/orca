import { describe, expect, it } from 'vitest'
import { redmineWorkspaceBranchName, redmineWorkspaceSeedName } from './redmine-workspace-name'

describe('redmine workspace naming', () => {
  it('builds a feature branch from the issue id and slugified subject', () => {
    expect(redmineWorkspaceBranchName({ id: 5969, subject: 'Fix the Login Redirect' })).toBe(
      'feature/5969-fix-the-login-redirect'
    )
  })

  it('keeps the workspace seed slash-free so it can name a directory', () => {
    const seed = redmineWorkspaceSeedName({ id: 42, subject: 'refactor/auth guard' })
    expect(seed).toBe('42-refactor-auth-guard')
    expect(seed).not.toContain('/')
  })

  it('falls back to the bare issue id when the subject slugifies to nothing', () => {
    expect(redmineWorkspaceBranchName({ id: 7, subject: '???' })).toBe('feature/7')
  })
})
