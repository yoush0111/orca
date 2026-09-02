import { useCallback, useMemo } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { openHttpLink } from '@/lib/http-link-routing'
import { getComposerEligibleRepos } from '@/lib/new-workspace-composer-repo'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { resolveRedmineIssueOpenOptions } from './task-page-redmine-link-routing'
import { resolveRedmineRepoId } from '../../../shared/redmine-project-repo-map'
import type { RedmineIssue, RedmineProject } from '../../../shared/redmine-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'

type TaskPageRedmineIssueListProps = {
  issues: readonly RedmineIssue[]
  /** Feeds subproject inheritance when resolving the mapped repo per row. */
  projects: readonly RedmineProject[]
  onStartWorkspace: (issue: RedmineIssue) => void
}

function isMacShortcutPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
}

// Shared between the header and every row so the columns stay aligned.
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 md:grid-cols-[72px_minmax(0,1fr)_120px_140px_120px_56px_64px]'

function clampDoneRatio(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function RedmineIssueRow({
  issue,
  repoName,
  onOpenExternal,
  onStartWorkspace
}: {
  issue: RedmineIssue
  repoName: string | null
  onOpenExternal: (issue: RedmineIssue, event: React.MouseEvent) => void
  onStartWorkspace: (issue: RedmineIssue) => void
}): React.JSX.Element {
  const doneRatio = clampDoneRatio(issue.doneRatio)
  const assignee =
    issue.assignedTo?.name ??
    translate('auto.components.task.page.redmine.issue.list.unassigned', 'Unassigned')

  return (
    <div
      className={cn(
        ROW_GRID,
        'group/row min-h-12 py-2 text-left transition hover:bg-accent focus-within:bg-accent'
      )}
    >
      <span className="block truncate font-mono text-[12px] text-muted-foreground max-md:!hidden">
        #{issue.id}
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground md:hidden">
            #{issue.id}
          </span>
          <h3 className="min-w-0 truncate text-[13px] font-medium text-foreground">
            {issue.subject}
          </h3>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 md:!hidden">
          <span className="shrink-0 text-[11px] text-muted-foreground">{issue.status?.name}</span>
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">{assignee}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{doneRatio}%</span>
        </div>
      </div>

      <div className="flex min-w-0 max-md:!hidden">
        {issue.status ? (
          <span className="inline-flex max-w-full items-center rounded-full border border-border/50 bg-muted/35 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span className="truncate">{issue.status.name}</span>
          </span>
        ) : null}
      </div>

      <div className="min-w-0 max-md:!hidden">
        <span className="block truncate text-[12px] text-muted-foreground">
          {issue.project?.name ?? ''}
        </span>
        {repoName ? (
          <span className="block truncate text-[11px] text-muted-foreground/70">
            {translate(
              'auto.components.task.page.redmine.issue.list.mappedRepo',
              'Repo: {{value0}}',
              { value0: repoName }
            )}
          </span>
        ) : null}
      </div>

      <span className="block truncate text-[12px] text-muted-foreground max-md:!hidden">
        {assignee}
      </span>

      <span className="block text-right text-[12px] tabular-nums text-muted-foreground max-md:!hidden">
        {doneRatio}%
      </span>

      <div className="flex shrink-0 items-center justify-end gap-1 md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onStartWorkspace(issue)}
              aria-label={translate(
                'auto.components.task.page.redmine.issue.list.startWorkspaceFrom',
                'Start workspace from #{{value0}}',
                { value0: issue.id }
              )}
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate(
              'auto.components.task.page.redmine.issue.list.startWorkspace',
              'Start workspace'
            )}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(event) => onOpenExternal(issue, event)}
              aria-label={translate(
                'auto.components.task.page.redmine.issue.list.openInRedmine',
                'Open #{{value0}} in Redmine',
                { value0: issue.id }
              )}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate(
              'auto.components.task.page.redmine.issue.list.openInRedmineShort',
              'Open in Redmine'
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function TaskPageRedmineIssueList({
  issues,
  projects,
  onStartWorkspace
}: TaskPageRedmineIssueListProps): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const repos = useAppStore((s) => s.repos)
  const projectRepoMap = useAppStore((s) => s.settings?.redmineProjectRepoMap)
  const repoNameByProjectId = useMemo(() => {
    const eligibleRepos = getComposerEligibleRepos(repos)
    const eligibleRepoIds = eligibleRepos.map((repo) => repo.id)
    const labels = new Map<number, string>()
    for (const issue of issues) {
      const projectId = issue.project?.id
      if (typeof projectId !== 'number' || labels.has(projectId)) {
        continue
      }
      const repoId = resolveRedmineRepoId({
        map: projectRepoMap,
        projectId,
        projects,
        eligibleRepoIds
      })
      const repo = repoId ? eligibleRepos.find((entry) => entry.id === repoId) : null
      if (repo) {
        labels.set(projectId, repo.displayName)
      }
    }
    return labels
  }, [issues, projectRepoMap, projects, repos])
  // Why fall back to activeWorktreeId: a floating-workspace tab is invisible
  // if the panel feature itself is off, so the toggle only takes effect when
  // floatingTerminalEnabled is also on.
  // `!== false` because the setting is default-on and absent in older profiles.
  const openInFloatingWorkspace = useAppStore(
    (s) =>
      s.settings?.redmineLinksOpenInFloatingWorkspace !== false &&
      s.settings?.floatingTerminalEnabled === true
  )
  const targetWorktreeId = openInFloatingWorkspace
    ? FLOATING_TERMINAL_WORKTREE_ID
    : activeWorktreeId
  // Why: route through Link Routing so the issue can land in an Orca browser
  // tab; Shift+Cmd/Ctrl stays the system-browser escape hatch.
  const handleOpenExternal = useCallback(
    (issue: RedmineIssue, event: React.MouseEvent): void => {
      openHttpLink(
        issue.url,
        resolveRedmineIssueOpenOptions(
          event,
          isMacShortcutPlatform(),
          targetWorktreeId,
          openInFloatingWorkspace
        )
      )
    },
    [targetWorktreeId, openInFloatingWorkspace]
  )

  return (
    <div>
      <div
        className={cn(
          ROW_GRID,
          'h-8 border-b border-border/50 bg-muted/20 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground max-md:!hidden'
        )}
      >
        <span>{translate('auto.components.task.page.redmine.issue.list.columnId', 'ID')}</span>
        <span>
          {translate('auto.components.task.page.redmine.issue.list.columnSubject', 'Subject')}
        </span>
        <span>
          {translate('auto.components.task.page.redmine.issue.list.columnStatus', 'Status')}
        </span>
        <span>
          {translate('auto.components.task.page.redmine.issue.list.columnProject', 'Project')}
        </span>
        <span>
          {translate('auto.components.task.page.redmine.issue.list.columnAssignee', 'Assignee')}
        </span>
        <span className="text-right">
          {translate('auto.components.task.page.redmine.issue.list.columnDone', 'Done')}
        </span>
        <span />
      </div>
      <div className="divide-y divide-border/50">
        {issues.map((issue) => (
          <RedmineIssueRow
            key={issue.id}
            issue={issue}
            repoName={
              (typeof issue.project?.id === 'number'
                ? repoNameByProjectId.get(issue.project.id)
                : null) ?? null
            }
            onOpenExternal={handleOpenExternal}
            onStartWorkspace={onStartWorkspace}
          />
        ))}
      </div>
    </div>
  )
}
