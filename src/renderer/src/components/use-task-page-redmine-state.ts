import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TaskPageComposerActionsModel } from './use-task-page-composer-actions'
import { buildRedmineTaskSourceContext } from '@/components/redmine-task-source-context'
import { getComposerEligibleRepos } from '@/lib/new-workspace-composer-repo'
import { buildRedmineComposerLinkedWorkItem } from '@/lib/redmine-composer-linked-work-item'
import { resolveRedmineRepoId } from '../../../shared/redmine-project-repo-map'
import type { RedmineIssue, RedmineProject } from '../../../shared/redmine-types'
import { redmineWorkspaceSeedName } from '../../../shared/redmine-workspace-name'

export function useTaskPageRedmineState(model: TaskPageComposerActionsModel) {
  const {
    accountBackedTaskSourceHostId,
    checkRedmineConnection,
    fallbackTaskSourceProjectId,
    openModal,
    redmineStatus,
    redmineStatusReady,
    repos,
    settings
  } = model
  const [redmineConnectOpen, setRedmineConnectOpen] = useState(false)
  const [redmineProjects, setRedmineProjects] = useState<RedmineProject[]>([])

  useEffect(() => {
    if (!redmineStatusReady) {
      void checkRedmineConnection()
    }
  }, [checkRedmineConnection, redmineStatusReady])

  const redmineTaskSourceContext = useMemo(
    () =>
      buildRedmineTaskSourceContext({
        projectId: fallbackTaskSourceProjectId,
        hostId: accountBackedTaskSourceHostId,
        baseUrl: redmineStatus.connection?.baseUrl ?? null
      }),
    [accountBackedTaskSourceHostId, fallbackTaskSourceProjectId, redmineStatus.connection]
  )

  const handleUseRedmineItem = useCallback(
    (issue: RedmineIssue): void => {
      const mappedRepoId = resolveRedmineRepoId({
        map: settings?.redmineProjectRepoMap,
        projectId: issue.project?.id ?? null,
        projects: redmineProjects,
        eligibleRepoIds: getComposerEligibleRepos(repos).map((repo) => repo.id)
      })
      openModal('new-workspace-composer', {
        linkedWorkItem: buildRedmineComposerLinkedWorkItem(issue),
        taskSourceContext: redmineTaskSourceContext,
        prefilledName: redmineWorkspaceSeedName(issue),
        ...(mappedRepoId ? { initialRepoId: mappedRepoId } : {}),
        telemetrySource: 'sidebar'
      })
    },
    [openModal, redmineProjects, redmineTaskSourceContext, repos, settings?.redmineProjectRepoMap]
  )

  const nextModel = model as typeof model & {
    redmineConnectOpen: typeof redmineConnectOpen
    setRedmineConnectOpen: typeof setRedmineConnectOpen
    setRedmineProjects: typeof setRedmineProjects
    redmineTaskSourceContext: typeof redmineTaskSourceContext
    handleUseRedmineItem: typeof handleUseRedmineItem
  }
  nextModel.redmineConnectOpen = redmineConnectOpen
  nextModel.setRedmineConnectOpen = setRedmineConnectOpen
  nextModel.setRedmineProjects = setRedmineProjects
  nextModel.redmineTaskSourceContext = redmineTaskSourceContext
  nextModel.handleUseRedmineItem = handleUseRedmineItem
  return nextModel
}

export type TaskPageRedmineStateModel = ReturnType<typeof useTaskPageRedmineState>
