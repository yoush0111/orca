import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { buildRedmineWorkspaceSource } from '../../../shared/new-workspace/workspace-source'
import type { RedmineIssue } from '../../../shared/redmine-types'

// Why: the list payload already carries the issue body, so the agent prompt gets it without a
// Redmine round trip; main's linked-item normalizer drops linkedContext before persisting.
export function buildRedmineComposerLinkedWorkItem(issue: RedmineIssue): LinkedWorkItemSummary {
  const renderedText = [
    `Status: ${issue.status?.name ?? '-'}`,
    `Project: ${issue.project?.name ?? '-'}`,
    `Assignee: ${issue.assignedTo?.name ?? '-'}`,
    `Done: ${issue.doneRatio}%`,
    '',
    issue.description?.trim() || '(no description)'
  ].join('\n')
  return {
    ...buildRedmineWorkspaceSource(issue),
    linkedContext: { provider: 'redmine', version: 1, renderedText }
  }
}
