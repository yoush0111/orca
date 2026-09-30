import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderCircle, RefreshCw, Settings2 } from 'lucide-react'

import { RedmineIcon } from '@/components/icons/RedmineIcon'
import { TaskPageRedmineIssueList } from '@/components/task-page-redmine-issue-list'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import {
  redmineListIssues,
  redmineListProjects,
  redmineListStatuses
} from '@/runtime/runtime-redmine-client'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { REDMINE_INTEGRATION_SECTION_ID } from '@/components/settings/task-provider-integration-section-ids'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import type { RedmineIssue, RedmineNamedRef, RedmineProject } from '../../../shared/redmine-types'

const ALL_PROJECTS = 'all'
const REDMINE_ITEM_LIMIT = 100

export type TaskPageRedminePanelProps = {
  onConnectRequest: () => void
  onHideProvider: () => void
  onStartWorkspace: (issue: RedmineIssue) => void
  /** Lifts the project list so the composer can resolve subproject repo mappings. */
  onProjectsLoaded?: (projects: RedmineProject[]) => void
  sourceContext: TaskSourceContext | null
}

export function TaskPageRedminePanel({
  onConnectRequest,
  onHideProvider,
  onStartWorkspace,
  onProjectsLoaded,
  sourceContext
}: TaskPageRedminePanelProps): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const redmineStatus = useAppStore((s) => s.redmineStatus)
  const redmineStatusChecked = useAppStore((s) => s.redmineStatusChecked)
  const redmineStatusContextKey = useAppStore((s) => s.redmineStatusContextKey)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  // Why: a status read from the previous runtime must not render as connected
  // while the new host's check is still in flight.
  const statusCurrent = redmineStatusContextKey === getProviderRuntimeContextKey(settings)
  const statusReady = statusCurrent && redmineStatusChecked
  const connected = statusCurrent && redmineStatus.connected

  const [mineOnly, setMineOnly] = useState(true)
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS)
  const [statusId, setStatusId] = useState<string>('open')
  const [issues, setIssues] = useState<RedmineIssue[]>([])
  const [projects, setProjects] = useState<RedmineProject[]>([])
  const [statuses, setStatuses] = useState<RedmineNamedRef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readSettings = useMemo(() => sourceContext ?? settings, [sourceContext, settings])

  useEffect(() => {
    if (!connected) {
      setProjects([])
      setStatuses([])
      onProjectsLoaded?.([])
      return
    }
    let cancelled = false
    void Promise.all([redmineListProjects(readSettings), redmineListStatuses(readSettings)])
      .then(([nextProjects, nextStatuses]) => {
        if (!cancelled) {
          setProjects(nextProjects)
          setStatuses(nextStatuses)
          onProjectsLoaded?.(nextProjects)
        }
      })
      .catch(() => {
        // Filter options are optional chrome; the issue read below reports failures.
      })
    return () => {
      cancelled = true
    }
  }, [connected, onProjectsLoaded, readSettings])

  const loadIssues = useCallback(async (): Promise<void> => {
    if (!connected) {
      setIssues([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await redmineListIssues(readSettings, {
        mineOnly,
        projectId: projectId === ALL_PROJECTS ? null : Number(projectId),
        statusId,
        limit: REDMINE_ITEM_LIMIT
      })
      setIssues(next)
    } catch (loadError) {
      console.error('[TaskPage] Redmine issue read failed', {
        error: loadError instanceof Error ? loadError.message : String(loadError)
      })
      setIssues([])
      setError(
        loadError instanceof Error
          ? loadError.message
          : translate(
              'auto.components.task.page.redmine.panel.loadFailed',
              'Could not load Redmine issues.'
            )
      )
    } finally {
      setLoading(false)
    }
  }, [connected, mineOnly, projectId, readSettings, statusId])

  useEffect(() => {
    void loadIssues()
  }, [loadIssues])

  if (!statusReady) {
    return (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
        <RedmineIcon className="mb-4 size-8 text-muted-foreground/60" />
        <p className="text-base font-medium text-foreground">
          {translate('auto.components.task.page.redmine.panel.connectTitle', 'Connect Redmine')}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {translate(
            'auto.components.task.page.redmine.panel.connectBody',
            'Browse Redmine issues and start work on them directly from here.'
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={onConnectRequest}>
            {translate('auto.components.task.page.redmine.panel.connectAction', 'Connect Redmine')}
          </Button>
          <Button variant="outline" onClick={onHideProvider}>
            {translate('auto.components.task.page.redmine.panel.hideAction', 'Hide Redmine')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
      <div className="flex h-10 flex-none flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/35 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="redmine-mine-only"
              checked={mineOnly}
              onCheckedChange={setMineOnly}
              aria-label={translate(
                'auto.components.task.page.redmine.panel.mineOnly',
                'Assigned to me'
              )}
            />
            <Label htmlFor="redmine-mine-only" className="text-xs text-muted-foreground">
              {translate('auto.components.task.page.redmine.panel.mineOnly', 'Assigned to me')}
            </Label>
          </div>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-7 w-[180px] rounded-md border-border/50 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>
                {translate('auto.components.task.page.redmine.panel.allProjects', 'All projects')}
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusId} onValueChange={setStatusId}>
            <SelectTrigger className="h-7 w-[150px] rounded-md border-border/50 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">
                {translate('auto.components.task.page.redmine.panel.statusOpen', 'Open')}
              </SelectItem>
              <SelectItem value="closed">
                {translate('auto.components.task.page.redmine.panel.statusClosed', 'Closed')}
              </SelectItem>
              <SelectItem value="*">
                {translate('auto.components.task.page.redmine.panel.statusAll', 'Any status')}
              </SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={String(status.id)}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {issues.length} {translate('auto.components.task.page.redmine.panel.shown', 'shown')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={loading}
            onClick={() => void loadIssues()}
            aria-label={translate('auto.components.task.page.redmine.panel.refresh', 'Refresh')}
            title={translate('auto.components.task.page.redmine.panel.refresh', 'Refresh')}
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              openSettingsPage()
              openSettingsTarget({
                pane: 'integrations',
                repoId: null,
                sectionId: REDMINE_INTEGRATION_SECTION_ID
              })
            }}
            aria-label={translate(
              'auto.components.task.page.redmine.panel.openSettings',
              'Redmine settings'
            )}
            title={translate(
              'auto.components.task.page.redmine.panel.openSettings',
              'Redmine settings'
            )}
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek"
        style={{ scrollbarGutter: 'stable' }}
      >
        {redmineStatus.credentialError ? (
          <div className="border-b border-border px-4 py-4 text-sm text-destructive">
            {redmineStatus.credentialError}
          </div>
        ) : null}
        {error && !redmineStatus.credentialError ? (
          <div className="border-b border-border px-4 py-4 text-sm text-destructive">{error}</div>
        ) : null}

        {loading && issues.length === 0 ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="px-3 py-3">
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted/60" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && issues.length === 0 && !error && !redmineStatus.credentialError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {translate(
                'auto.components.task.page.redmine.panel.emptyTitle',
                'No Redmine issues found'
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {translate(
                'auto.components.task.page.redmine.panel.emptyBody',
                'No issues match the selected filters.'
              )}
            </p>
          </div>
        ) : null}

        {issues.length > 0 ? (
          <TaskPageRedmineIssueList
            issues={issues}
            projects={projects}
            onStartWorkspace={onStartWorkspace}
          />
        ) : null}
      </div>
    </div>
  )
}
