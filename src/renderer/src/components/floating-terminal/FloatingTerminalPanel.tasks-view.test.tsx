import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTab, setFloatingTabs } from './floating-terminal-panel-test-fixtures'
import { setupFloatingTerminalPanelTest } from './floating-terminal-panel-test-harness'
import {
  findAllByTypeName,
  findByProp,
  getMockedLocalStorage,
  renderPanel,
  runEffects
} from './floating-terminal-panel-render-probe'
import { FLOATING_TERMINAL_PANEL_VIEW_STATE_STORAGE_KEY } from './floating-terminal-panel-view-state'

vi.mock('zustand/react/shallow', () => ({
  // Why: zustand resolves the real react (unmocked in node_modules); the memo wrapper is inert here.
  useShallow: (selector: unknown) => selector
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react') // eslint-disable-line @typescript-eslint/consistent-type-imports -- vi.importActual requires inline import()
  const { createReactHookOverrides } = await import('./floating-terminal-panel-test-module-mocks')
  return { ...actual, ...createReactHookOverrides() }
})

vi.mock('@/store', async () => {
  return (await import('./floating-terminal-panel-test-module-mocks')).createAppStoreModule()
})

vi.mock('@/components/tab-bar/TabBar', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createTabBarModule()
})

vi.mock('@/components/terminal-pane/TerminalPane', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createTerminalPaneModule()
})

vi.mock('@/components/terminal-pane/use-terminal-tab-cold-parking', async () => {
  return (await import('./floating-terminal-panel-test-module-mocks')).createColdParkingModule()
})

vi.mock('@/components/terminal-pane/terminal-parked-tab-watchers', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createParkedTabWatchersModule()
})

vi.mock('@/components/terminal-pane/terminal-ime-input-context-refresh', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createImeInputContextRefreshModule()
})

vi.mock('@/components/terminal/terminal-tab-actions', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createTerminalTabActionsModule()
})

vi.mock('@/store/pinned-tab-close-guard', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createPinnedTabCloseGuardModule()
})

vi.mock('@/components/browser-pane/BrowserPane', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createBrowserPaneModule()
})

vi.mock('@/components/emulator-pane/EmulatorPane', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createEmulatorPaneModule()
})

vi.mock('@/components/editor/EditorPanel', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createEditorPanelModule()
})

vi.mock('@/components/ui/button', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createButtonModule()
})

vi.mock('@/components/contextual-tours/use-contextual-tour', async () => {
  return (await import('./floating-terminal-panel-test-module-mocks')).createContextualTourModule()
})

vi.mock('@/components/ui/dialog', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createDialogModule()
})

vi.mock('@/components/terminal/useTerminalSaveDialog', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createTerminalSaveDialogModule()
})

vi.mock('@/runtime/web-runtime-session', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createWebRuntimeSessionModule()
})

vi.mock('@/lib/connection-context', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createConnectionContextModule()
})

// Why inline and sync: this module is imported by the test file itself, so an async factory
// resolves too late and the panel ends up calling a second copy of the mock.
vi.mock('@/lib/create-untitled-markdown', () => ({
  createUntitledMarkdownFileWithTemplateSelection: vi.fn()
}))

vi.mock('@/lib/ipc-error', async () => {
  return (await import('./floating-terminal-panel-test-module-mocks')).createIpcErrorModule()
})

vi.mock('sonner', async () => {
  return (await import('./floating-terminal-panel-test-module-mocks')).createSonnerModule()
})

vi.mock('@/lib/focus-terminal-tab-surface', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createFocusTerminalTabSurfaceModule()
})

vi.mock('@/lib/orchestration-setup-state', async () => {
  return (
    await import('./floating-terminal-panel-test-module-mocks')
  ).createOrchestrationSetupStateModule()
})

vi.mock('./FloatingTerminalOrchestrationDialog', async () => {
  return (
    await import('./floating-terminal-panel-component-stubs')
  ).createOrchestrationDialogModule()
})

vi.mock('./FloatingTerminalResizeHandles', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createResizeHandlesModule()
})

vi.mock('./FloatingTerminalToggleButton', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createToggleButtonModule()
})

vi.mock('./FloatingTerminalWindowControls', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createWindowControlsModule()
})

vi.mock('@/components/ShortcutKeyCombo', async () => {
  return (await import('./floating-terminal-panel-component-stubs')).createShortcutKeyComboModule()
})

// Why capture instead of render: the real view fetches Redmine over IPC.
const tasksViewRendered = vi.fn()
vi.mock('./FloatingWorkspaceTasksView', () => ({
  FloatingWorkspaceTasksView: (props: Record<string, unknown>) => {
    tasksViewRendered(props)
    return null
  }
}))

function findTasksToggle(tree: unknown): { props: Record<string, unknown> } {
  return findByProp(tree, 'data-floating-workspace-tasks-toggle')
}

describe('FloatingTerminalPanel tasks view', () => {
  beforeEach(async () => {
    tasksViewRendered.mockClear()
    await setupFloatingTerminalPanelTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offers a titlebar toggle but does not render the tasks view until it is pressed', async () => {
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    const tree = await renderPanel(true)
    runEffects()

    expect(findTasksToggle(tree)).toBeTruthy()
    expect(findAllByTypeName(tree, 'FloatingWorkspaceTasksView')).toHaveLength(0)
    expect(tasksViewRendered).not.toHaveBeenCalled()
  })

  it('renders the tasks view over the panel body without unmounting terminal panes', async () => {
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    const first = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(first).props.onClick as () => void)()

    const next = await renderPanel(true)
    runEffects()

    expect(findAllByTypeName(next, 'FloatingWorkspaceTasksView')).toHaveLength(1)
    // Why: unmounting terminal panes would detach the PTY and reflow the xterm
    // buffer, so the tasks view must sit on top of them, not replace them.
    expect(findAllByTypeName(next, 'WorkspacePaneOverlayLayers')).toHaveLength(1)
  })

  it('closes the tasks view again when the toggle is pressed a second time', async () => {
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    const first = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(first).props.onClick as () => void)()

    const opened = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(opened).props.onClick as () => void)()

    const closed = await renderPanel(true)
    runEffects()

    expect(findAllByTypeName(closed, 'FloatingWorkspaceTasksView')).toHaveLength(0)
  })

  it('restores a tasks view that was open when the app last shut down', async () => {
    getMockedLocalStorage().getItem.mockImplementation((key: string) =>
      key === FLOATING_TERMINAL_PANEL_VIEW_STATE_STORAGE_KEY
        ? JSON.stringify({ open: true, maximized: false, tasksView: true })
        : null
    )
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    const tree = await renderPanel(true)
    runEffects()

    expect(findAllByTypeName(tree, 'FloatingWorkspaceTasksView')).toHaveLength(1)
  })

  it('persists the tasks view flag so a restart lands back on it', async () => {
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    const tree = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(tree).props.onClick as () => void)()

    await renderPanel(true)
    runEffects()

    expect(getMockedLocalStorage().setItem).toHaveBeenCalledWith(
      FLOATING_TERMINAL_PANEL_VIEW_STATE_STORAGE_KEY,
      expect.stringContaining('"tasksView":true')
    )
  })

  it('reveals a newly activated floating tab by closing the tasks view', async () => {
    // Why: opening a Redmine issue from the list lands a browser tab underneath
    // the overlay, so leaving the overlay up hides the very page it just opened.
    setFloatingTabs([makeTab({ id: 'tab-1' })])
    const tree = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(tree).props.onClick as () => void)()

    const opened = await renderPanel(true)
    runEffects()
    expect(findAllByTypeName(opened, 'FloatingWorkspaceTasksView')).toHaveLength(1)

    setFloatingTabs([makeTab({ id: 'tab-2' }), makeTab({ id: 'tab-1' })])
    await renderPanel(true)
    runEffects()

    const settled = await renderPanel(true)
    runEffects()
    expect(findAllByTypeName(settled, 'FloatingWorkspaceTasksView')).toHaveLength(0)
  })

  it('keeps a restored tasks view up when the active tab has not changed', async () => {
    getMockedLocalStorage().getItem.mockImplementation((key: string) =>
      key === FLOATING_TERMINAL_PANEL_VIEW_STATE_STORAGE_KEY
        ? JSON.stringify({ open: true, maximized: false, tasksView: true })
        : null
    )
    setFloatingTabs([makeTab({ id: 'tab-1' })])

    await renderPanel(true)
    runEffects()
    const settled = await renderPanel(true)
    runEffects()

    expect(findAllByTypeName(settled, 'FloatingWorkspaceTasksView')).toHaveLength(1)
  })

  it('steps aside for the first tab opened from an otherwise empty floating panel', async () => {
    // Why pinned: the Redmine link action is the common case and it usually runs
    // on an empty floating workspace, where there is no prior active tab at all.
    setFloatingTabs([])
    const tree = await renderPanel(true)
    runEffects()
    ;(findTasksToggle(tree).props.onClick as () => void)()

    const opened = await renderPanel(true)
    runEffects()
    expect(findAllByTypeName(opened, 'FloatingWorkspaceTasksView')).toHaveLength(1)

    setFloatingTabs([makeTab({ id: 'browser-tab' })])
    await renderPanel(true)
    runEffects()

    const settled = await renderPanel(true)
    runEffects()
    expect(findAllByTypeName(settled, 'FloatingWorkspaceTasksView')).toHaveLength(0)
  })
})
