import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import type { RedmineIssue } from '../../../shared/redmine-types'

type TaskPageRedmineIssueSheetProps = {
  issue: RedmineIssue | null
  repoName: string | null
  onClose: () => void
  onStartWorkspace: (issue: RedmineIssue) => void
  onOpenExternal: (issue: RedmineIssue, event: React.MouseEvent) => void
}

export function clampDoneRatio(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function IssueField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-foreground">{value}</dd>
    </>
  )
}

function IssueFields({
  issue,
  repoName
}: {
  issue: RedmineIssue
  repoName: string | null
}): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px]">
      <IssueField
        label={translate('auto.components.task.page.redmine.issue.list.columnStatus', 'Status')}
        value={issue.status?.name ?? '—'}
      />
      <IssueField
        label={translate('auto.components.task.page.redmine.issue.list.columnProject', 'Project')}
        value={issue.project?.name ?? '—'}
      />
      {repoName ? (
        <IssueField
          label={translate('auto.components.task.page.redmine.issue.list.fieldRepo', 'Repository')}
          value={repoName}
        />
      ) : null}
      <IssueField
        label={translate('auto.components.task.page.redmine.issue.list.columnAssignee', 'Assignee')}
        value={
          issue.assignedTo?.name ??
          translate('auto.components.task.page.redmine.issue.list.unassigned', 'Unassigned')
        }
      />
      <IssueField
        label={translate('auto.components.task.page.redmine.issue.list.columnDone', 'Done')}
        value={`${clampDoneRatio(issue.doneRatio)}%`}
      />
      {issue.updatedAt ? (
        <IssueField
          label={translate('auto.components.task.page.redmine.issue.list.fieldUpdated', 'Updated')}
          value={formatUiRelativeTimeFromDate(issue.updatedAt)}
        />
      ) : null}
    </dl>
  )
}

function IssueDescription({ description }: { description?: string }): React.JSX.Element {
  const text = description?.trim()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-4 py-4">
      <h4 className="pb-2 text-[13px] font-medium text-foreground">
        {translate('auto.components.task.page.redmine.issue.list.description', 'Description')}
      </h4>
      {/* Why sanitized raw HTML: Redmine bodies are often HTML (CKEditor) or Markdown. */}
      {text ? (
        <CommentMarkdown
          content={text}
          variant="document"
          className="text-[13px] leading-relaxed"
        />
      ) : (
        <p className="text-[13px] text-muted-foreground">
          {translate(
            'auto.components.task.page.redmine.issue.list.noDescription',
            'No description.'
          )}
        </p>
      )}
    </div>
  )
}

export function TaskPageRedmineIssueSheet({
  issue,
  repoName,
  onClose,
  onStartWorkspace,
  onOpenExternal
}: TaskPageRedmineIssueSheetProps): React.JSX.Element {
  return (
    <Sheet open={issue !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        {issue ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-none flex-col gap-2 border-b border-border/60 px-4 py-3 pr-10">
              <span className="font-mono text-[12px] text-muted-foreground">#{issue.id}</span>
              <SheetTitle>{issue.subject}</SheetTitle>
              <SheetDescription className="sr-only">
                {translate(
                  'auto.components.task.page.redmine.issue.list.detailsDescription',
                  'Details of the selected Redmine issue.'
                )}
              </SheetDescription>
              <IssueFields issue={issue} repoName={repoName} />
            </div>

            <IssueDescription description={issue.description} />

            <div className="flex flex-none items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
              <Button variant="outline" size="sm" onClick={(event) => onOpenExternal(issue, event)}>
                <ExternalLink className="size-3.5" />
                {translate(
                  'auto.components.task.page.redmine.issue.list.openInRedmineShort',
                  'Open in Redmine'
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onClose()
                  onStartWorkspace(issue)
                }}
              >
                <ArrowRight className="size-3.5" />
                {translate(
                  'auto.components.task.page.redmine.issue.list.startWorkspace',
                  'Start workspace'
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
