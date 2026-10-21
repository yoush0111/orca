import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { getSidebarHeaderCollapseKeys } from './collapse-all-sidebar-groups'
import { getVisibleWorktreeIds, setVisibleWorktreeIds } from './visible-worktrees'

const initialState = useAppStore.getInitialState()

function makeWorktree(id: string, repoId: string): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture fills only the fields the sidebar rows read.
  return {
    id,
    repoId,
    path: `/tmp/${id}`,
    head: 'abc123',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: true,
    displayName: id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0
  } as Worktree
}

function makeRepo(id: string): Repo {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture fills only the fields the sidebar rows read.
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    defaultBranch: 'main',
    connectionId: null
  } as unknown as Repo
}

afterEach(() => {
  vi.unstubAllGlobals()
  setVisibleWorktreeIds(null)
  useAppStore.setState(initialState, true)
})

it('collapses and expands every project header', () => {
  useAppStore.setState(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: seeds only the fields the sidebar rows read.
    {
      ...initialState,
      repos: [makeRepo('repo1'), makeRepo('repo2')],
      worktreesByRepo: {
        repo1: [makeWorktree('wt1', 'repo1')],
        repo2: [makeWorktree('wt2', 'repo2')]
      },
      showSleepingWorkspaces: true,
      groupBy: 'repo',
      sortBy: 'manual'
    } as AppState,
    true
  )
  setVisibleWorktreeIds(null)
  const persist = vi.fn(() => Promise.resolve())
  vi.stubGlobal('window', { api: { ui: { set: persist } } })
  const state = useAppStore.getState()

  const keys = getSidebarHeaderCollapseKeys(state)
  expect(keys).toEqual(['project:repo:repo1', 'project:repo:repo2'])

  state.setGroupsCollapsed(keys, true)
  expect(getVisibleWorktreeIds()).toEqual([])
  expect(persist).toHaveBeenCalledWith({ collapsedGroups: keys })
  // Headers stay reachable while collapsed, so expand-all can find them again.
  expect(getSidebarHeaderCollapseKeys(useAppStore.getState())).toEqual(keys)

  useAppStore.getState().setGroupsCollapsed(keys, false)
  expect(getVisibleWorktreeIds()).toEqual(['wt1', 'wt2'])
})
