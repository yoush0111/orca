import { useCallback, useEffect, useRef, useState } from 'react'
import {
  persistFloatingTerminalPanelTasksView,
  readPersistedFloatingTerminalPanelViewState
} from './floating-terminal-panel-view-state'
import type { useFloatingWorkspaceChromeModel } from './use-floating-workspace-chrome-model'

export function useFloatingTerminalPanelTasksView({
  activeTab
}: Pick<ReturnType<typeof useFloatingWorkspaceChromeModel>, 'activeTab'>) {
  const [tasksViewOpen, setTasksViewOpen] = useState(
    () => readPersistedFloatingTerminalPanelViewState()?.tasksView === true
  )
  const setTasksViewOpenPersisted = useCallback((next: boolean): void => {
    setTasksViewOpen(next)
    persistFloatingTerminalPanelTasksView(next)
  }, [])
  // `undefined` means "not observed yet" — distinct from an empty panel's null.
  const activeTabIdRef = useRef<string | null | undefined>(undefined)

  // Why: the tasks view covers the body but not the tab strip, so anything that
  // activates a tab — a Redmine link opening a browser tab, or a plain tab click —
  // would otherwise land invisibly underneath it.
  useEffect(() => {
    const activeTabId = activeTab?.id ?? null
    const previousActiveTabId = activeTabIdRef.current
    activeTabIdRef.current = activeTabId
    if (tasksViewOpen && previousActiveTabId !== undefined && previousActiveTabId !== activeTabId) {
      setTasksViewOpenPersisted(false)
    }
  }, [activeTab, setTasksViewOpenPersisted, tasksViewOpen])

  return { tasksViewOpen, setTasksViewOpenPersisted }
}
