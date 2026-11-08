import type { AppState } from '@/store/types'
import { computeRenderedSidebarRows } from './worktree-list/listing/rendered-sidebar-worktree-order'
import { computeVisibleWorktrees } from './worktree-list/listing/compute-visible-worktrees'
import { buildVisibleWorktreeOptionsFromState } from './worktree-list/listing/visible-worktree-options-from-state'

// Why headers only: host sections stay open so the collapsed projects remain visible under them.
// Why rendered with nothing collapsed: headers nested in a collapsed group must be reached too.
export function getSidebarHeaderCollapseKeys(state: AppState): string[] {
  const visibleWorktrees = computeVisibleWorktrees(
    state.worktreesByRepo,
    [],
    buildVisibleWorktreeOptionsFromState(state, new Map(state.repos.map((repo) => [repo.id, repo])))
  )
  return computeRenderedSidebarRows(
    { ...state, collapsedGroups: new Set() },
    visibleWorktrees
  ).flatMap((row) => (row.type === 'header' ? [row.collapseKey ?? row.key] : []))
}
