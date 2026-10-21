import { getRepoMapFromState } from '@/store/selectors'
import type { AppState } from '@/store/types'
import { computeRenderedSidebarRows } from './rendered-sidebar-worktree-order'
import { computeVisibleWorktrees } from './visible-worktrees'
import { buildVisibleWorktreeOptionsFromState } from './visible-worktree-options-from-state'

// Why headers only: host sections stay open so the collapsed projects remain visible under them.
// Why rendered with nothing collapsed: headers nested in a collapsed group must be reached too.
export function getSidebarHeaderCollapseKeys(state: AppState): string[] {
  const visibleWorktrees = computeVisibleWorktrees(
    state.worktreesByRepo,
    [],
    buildVisibleWorktreeOptionsFromState(state, getRepoMapFromState(state))
  )
  return computeRenderedSidebarRows(
    { ...state, collapsedGroups: new Set() },
    visibleWorktrees
  ).flatMap((row) => (row.type === 'header' ? [row.collapseKey ?? row.key] : []))
}
