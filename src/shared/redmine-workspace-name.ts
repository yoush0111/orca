import { slugifyForWorkspaceName } from './workspace-name'

export const REDMINE_BRANCH_PREFIX = 'feature'

function issueSlug(issue: { id: number; subject: string }): string {
  const slug = slugifyForWorkspaceName(issue.subject)
  return slug ? `${issue.id}-${slug}` : `${issue.id}`
}

/** Workspace/folder name. Slash-free because worktree names become directories. */
export function redmineWorkspaceSeedName(issue: { id: number; subject: string }): string {
  return issueSlug(issue)
}

/**
 * Exact git ref for the workspace, bypassing the configured branch prefix the
 * same way a Linear issue's canonical branch does.
 */
export function redmineWorkspaceBranchName(issue: { id: number; subject: string }): string {
  return `${REDMINE_BRANCH_PREFIX}/${issueSlug(issue)}`
}
