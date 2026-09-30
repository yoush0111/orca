import { useCallback, useEffect, useMemo, useState } from 'react'

import { RedmineConnectDialog } from '@/components/redmine-connect-dialog'
import {
  ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID,
  buildRedmineTaskSourceContext
} from '@/components/redmine-task-source-context'
import { TaskPageRedminePanel } from '@/components/task-page-redmine-panel'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { getSettingsFocusedExecutionHostId } from '../../../../shared/execution-host'
import { buildRedmineWorkspaceSource } from '../../../../shared/new-workspace/workspace-source'
import { redmineWorkspaceSeedName } from '../../../../shared/redmine-workspace-name'
import type { RedmineIssue } from '../../../../shared/redmine-types'

export function FloatingWorkspaceTasksView({
  onClose
}: {
  onClose: () => void
}): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const settings = useAppStore((s) => s.settings)
  const redmineConnection = useAppStore((s) => s.redmineStatus.connection)
  const redmineStatusChecked = useAppStore((s) => s.redmineStatusChecked)
  const redmineStatusContextKey = useAppStore((s) => s.redmineStatusContextKey)
  const checkRedmineConnection = useAppStore((s) => s.checkRedmineConnection)
  const [connectOpen, setConnectOpen] = useState(false)

  // Why: the panel spins until the status is checked, and TaskPage owns the only
  // other check — so opening this view first would spin forever.
  const redmineStatusReady =
    redmineStatusChecked && redmineStatusContextKey === getProviderRuntimeContextKey(settings)
  useEffect(() => {
    if (!redmineStatusReady) {
      void checkRedmineConnection()
    }
  }, [checkRedmineConnection, redmineStatusReady])

  // Why the account-backed project id: the floating workspace has no repo
  // selection to derive one from, which is the fallback TaskPage lands on too.
  const sourceContext = useMemo(
    () =>
      buildRedmineTaskSourceContext({
        projectId: ACCOUNT_BACKED_TASK_SOURCE_PROJECT_ID,
        hostId: getSettingsFocusedExecutionHostId(settings),
        baseUrl: redmineConnection?.baseUrl ?? null
      }),
    [redmineConnection, settings]
  )

  // Why no worktree id in the payload: the composer is a main-window modal and
  // the workspace it creates is a normal worktree, never the floating one.
  const handleStartWorkspace = useCallback(
    (issue: RedmineIssue): void => {
      openModal('new-workspace-composer', {
        linkedWorkItem: buildRedmineWorkspaceSource(issue),
        taskSourceContext: sourceContext,
        prefilledName: redmineWorkspaceSeedName(issue),
        telemetrySource: 'sidebar'
      })
    },
    [openModal, sourceContext]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background p-3">
      <TaskPageRedminePanel
        onConnectRequest={() => setConnectOpen(true)}
        // Why not TaskPage's hideTaskSource: silently rewriting the global
        // visible-provider setting from a floating panel is a surprise.
        onHideProvider={onClose}
        onStartWorkspace={handleStartWorkspace}
        sourceContext={sourceContext}
      />
      <RedmineConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}
