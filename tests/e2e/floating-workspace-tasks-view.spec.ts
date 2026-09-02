import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'

// Why: mirrors FLOATING_TERMINAL_WORKTREE_ID in src/shared/constants.ts.
// E2E specs avoid importing renderer/shared modules into the Playwright runner.
const PANEL_SELECTOR = '[data-floating-terminal-panel]'
const OPEN_PANEL_SELECTOR = `${PANEL_SELECTOR}[aria-hidden="false"]`
const TOGGLE_EVENT = 'orca-toggle-floating-terminal'
const TRIGGER_SELECTOR = '[data-floating-terminal-toggle]'
// Why: mirrors FLOATING_TERMINAL_WORKTREE_ID in src/shared/constants.ts.
const FLOATING_WORKTREE_ID = 'global-floating-terminal'
const TASKS_TOGGLE = '[data-floating-workspace-tasks-toggle]'
const TASKS_VIEW = '[data-floating-workspace-tasks-view]'

type E2EStoreState = {
  settings: Record<string, unknown>
  createBrowserTab: (
    worktreeId: string,
    url: string,
    options: { title: string; browserRuntimeEnvironmentId: null }
  ) => unknown
}

type E2EWindow = typeof window & {
  __store?: {
    getState: () => E2EStoreState
    setState: (partial: { settings: Record<string, unknown> }) => void
  }
}

async function enableFloatingWorkspace(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as E2EWindow).__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    store.setState({
      settings: { ...store.getState().settings, floatingTerminalEnabled: true }
    })
  })
  // Why wait for the trigger first: the panel only mounts once it is open or has
  // tabs, and the toggle listener closes over the enabled flag React has committed.
  await expect(page.locator(TRIGGER_SELECTOR).first()).toBeAttached({ timeout: 30_000 })
  if ((await page.locator(OPEN_PANEL_SELECTOR).count()) === 0) {
    await page.evaluate((eventName) => {
      window.dispatchEvent(new Event(eventName))
    }, TOGGLE_EVENT)
  }
  await expect(page.locator(OPEN_PANEL_SELECTOR)).toBeVisible({ timeout: 30_000 })
}

test('floating workspace tasks toggle covers the panel body and restores it', async ({
  orcaPage
}, testInfo) => {
  await enableFloatingWorkspace(orcaPage)

  const panel = orcaPage.locator(OPEN_PANEL_SELECTOR).first()
  const toggle = panel.locator(TASKS_TOGGLE)
  await expect(toggle).toBeVisible()
  await expect(panel.locator(TASKS_VIEW)).toHaveCount(0)

  await toggle.click()
  const tasksView = panel.locator(TASKS_VIEW)
  await expect(tasksView).toBeVisible()

  // Why: the overlay must actually cover the body, not sit in a corner —
  // a mis-sized layer would still be "visible" but leave panes exposed.
  const [viewBox, panelBox] = await Promise.all([tasksView.boundingBox(), panel.boundingBox()])
  expect(viewBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(viewBox!.width).toBeGreaterThan(panelBox!.width * 0.9)

  await testInfo.attach('floating-workspace-tasks-view', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })

  await toggle.click()
  await expect(panel.locator(TASKS_VIEW)).toHaveCount(0)
})

test('floating workspace tasks view covers an active browser webview', async ({
  orcaPage
}, testInfo) => {
  await enableFloatingWorkspace(orcaPage)

  await orcaPage.evaluate((worktreeId) => {
    const store = (window as E2EWindow).__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    store.getState().createBrowserTab(worktreeId, 'about:blank', {
      title: 'Browser',
      browserRuntimeEnvironmentId: null
    })
  }, FLOATING_WORKTREE_ID)

  const panel = orcaPage.locator(OPEN_PANEL_SELECTOR).first()
  await expect(panel.locator('webview')).toHaveCount(1, { timeout: 30_000 })

  await panel.locator(TASKS_TOGGLE).click()
  const tasksView = panel.locator(TASKS_VIEW)
  await expect(tasksView).toBeVisible()

  // Why: an Electron <webview> is composited by the host and can punch through a
  // DOM overlay. If that happens the screenshot shows the page, not the task view.
  await testInfo.attach('floating-workspace-tasks-view-over-webview', {
    body: await panel.screenshot(),
    contentType: 'image/png'
  })

  const [viewBox, panelBox] = await Promise.all([tasksView.boundingBox(), panel.boundingBox()])
  expect(viewBox!.width).toBeGreaterThan(panelBox!.width * 0.9)
  await expect(panel.locator('webview')).toHaveCount(1)
})

test('floating workspace tasks view steps aside for a tab it opens', async ({ orcaPage }) => {
  await enableFloatingWorkspace(orcaPage)

  const panel = orcaPage.locator(OPEN_PANEL_SELECTOR).first()
  await panel.locator(TASKS_TOGGLE).click()
  await expect(panel.locator(TASKS_VIEW)).toBeVisible()

  // Why: this is what "Open in Redmine" does from the task list — without the
  // step-aside the new page loads invisibly under the overlay.
  await orcaPage.evaluate((worktreeId) => {
    const store = (window as E2EWindow).__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    store.getState().createBrowserTab(worktreeId, 'about:blank', {
      title: 'Redmine',
      browserRuntimeEnvironmentId: null
    })
  }, FLOATING_WORKTREE_ID)

  await expect(panel.locator(TASKS_VIEW)).toHaveCount(0)
  await expect(panel.locator('webview')).toHaveCount(1, { timeout: 30_000 })
})
