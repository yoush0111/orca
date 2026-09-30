import type { RedmineIssueDetail } from '../shared/redmine-types'

export function formatRedmineIssue(issue: RedmineIssueDetail): string {
  const tracker = issue.tracker ? ` [${issue.tracker.name}]` : ''
  const lines = [
    `#${issue.id}${tracker} ${issue.subject}`,
    `status: ${issue.status?.name ?? '-'}  project: ${issue.project?.name ?? '-'}  assignee: ${issue.assignedTo?.name ?? '-'}  done: ${issue.doneRatio}%`,
    issue.url,
    '',
    issue.description?.trim() || '(no description)'
  ]
  if (issue.journals.length > 0) {
    lines.push('', 'Comments:')
    for (const journal of issue.journals) {
      lines.push(
        `- ${journal.author ?? 'unknown'} (${journal.createdAt}):`,
        `  ${journal.notes.replace(/\n/g, '\n  ')}`
      )
    }
  }
  if (issue.attachments.length > 0) {
    lines.push('', 'Attachments:')
    for (const attachment of issue.attachments) {
      lines.push(`- ${attachment.filename} (${attachment.filesize} bytes) ${attachment.url}`)
    }
  }
  return lines.join('\n')
}

export function formatRedmineNoteAdded(result: { id: number }): string {
  return `Added note to #${result.id}`
}
