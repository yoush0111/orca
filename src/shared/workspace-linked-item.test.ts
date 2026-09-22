import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceLinkedItem } from './workspace-linked-item'
import { WorktreeCreate } from './rpc-contract/worktree-create-params'

const redmineItem = {
  provider: 'redmine',
  type: 'issue',
  number: 5969,
  title: 'Fix login',
  url: 'https://redmine.example.com/issues/5969'
}

describe('normalizeWorkspaceLinkedItem', () => {
  it('keeps Redmine issues', () => {
    expect(normalizeWorkspaceLinkedItem(redmineItem)).toEqual(redmineItem)
  })

  it('lets worktree.create accept a Redmine linked work item', () => {
    const parsed = WorktreeCreate.safeParse({ repo: 'repo-1', linkedWorkItem: redmineItem })
    expect(parsed.success).toBe(true)
  })
})
