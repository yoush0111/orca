import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { getComposerEligibleRepos } from '@/lib/new-workspace-composer-repo'
import { redmineListProjects } from '@/runtime/runtime-redmine-client'
import { useAppStore } from '@/store'
import type { RedmineProject } from '../../../../shared/redmine-types'
import { SettingsSubsectionHeader } from './SettingsFormControls'

const ADD_PLACEHOLDER = 'add'

/** Full path label so subprojects are distinguishable from their parents. */
function projectPathLabel(project: RedmineProject, byId: Map<number, RedmineProject>): string {
  const names = [project.name]
  const seen = new Set<number>([project.id])
  let parentId = project.parent?.id
  while (typeof parentId === 'number' && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) {
      break
    }
    names.unshift(parent.name)
    parentId = parent.parent?.id
  }
  return names.join(' / ')
}

export function RedmineProjectRepoMapping(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const repos = useAppStore((s) => s.repos)
  const [projects, setProjects] = useState<RedmineProject[]>([])
  // Only the runtime decides which Redmine answers; other setting edits must not refetch.
  const runtimeEnvironmentId = settings?.activeRuntimeEnvironmentId ?? null

  useEffect(() => {
    let cancelled = false
    void redmineListProjects({
      activeRuntimeEnvironmentId: runtimeEnvironmentId
    })
      .then((next) => {
        if (!cancelled) {
          setProjects(next)
        }
      })
      .catch(() => {
        // Optional chrome: without projects the rows still render by id.
      })
    return () => {
      cancelled = true
    }
  }, [runtimeEnvironmentId])

  const eligibleRepos = useMemo(() => getComposerEligibleRepos(repos), [repos])
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const map = settings?.redmineProjectRepoMap ?? {}
  const mappedIds = Object.keys(map)
  const unmappedProjects = projects.filter((project) => !(String(project.id) in map))

  const setMapping = (projectId: string, repoId: string | null): void => {
    const next = { ...map }
    if (repoId) {
      next[projectId] = repoId
    } else {
      delete next[projectId]
    }
    void updateSettings({ redmineProjectRepoMap: next })
  }

  const labelFor = (projectId: string): string => {
    const project = projectsById.get(Number(projectId))
    return project ? projectPathLabel(project, projectsById) : `#${projectId}`
  }

  return (
    <div className="space-y-2">
      <SettingsSubsectionHeader
        title={translate(
          'auto.components.settings.redmine.project.repo.mapping.title',
          'Project repositories'
        )}
        description={translate(
          'auto.components.settings.redmine.project.repo.mapping.description',
          'Start Workspace picks this repository for issues in the project. Subprojects inherit their parent.'
        )}
      />
      {mappedIds.map((projectId) => (
        <div key={projectId} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">{labelFor(projectId)}</span>
          <Select value={map[projectId]} onValueChange={(repoId) => setMapping(projectId, repoId)}>
            <SelectTrigger className="h-7 w-[200px] rounded-md border-border/50 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eligibleRepos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setMapping(projectId, null)}
            aria-label={translate(
              'auto.components.settings.redmine.project.repo.mapping.remove',
              'Remove mapping'
            )}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      {unmappedProjects.length > 0 && eligibleRepos[0] ? (
        <Select
          value={ADD_PLACEHOLDER}
          onValueChange={(projectId) => setMapping(projectId, eligibleRepos[0]!.id)}
        >
          <SelectTrigger className="h-7 w-[240px] rounded-md border-border/50 bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADD_PLACEHOLDER} disabled>
              {translate(
                'auto.components.settings.redmine.project.repo.mapping.add',
                'Add a project…'
              )}
            </SelectItem>
            {unmappedProjects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {projectPathLabel(project, projectsById)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
