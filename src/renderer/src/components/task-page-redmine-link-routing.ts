import type { OpenHttpLinkOptions } from '@/lib/http-link-routing'

export function isRedmineSystemBrowserModifier(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>,
  isMac: boolean
): boolean {
  return event.shiftKey && (isMac ? event.metaKey : event.ctrlKey)
}

/**
 * Route a Redmine issue link through the Link Routing setting instead of always
 * reaching for the system browser. `sourceOwner: 'local'` because a Redmine
 * server is an ordinary web target, not a resource owned by the active runtime —
 * without it a remote-runtime session would refuse the in-app tab.
 *
 * `forceInApp` when the floating-workspace toggle is on: asking for the floating
 * workspace is already an explicit "open this inside Orca", so Link Routing
 * being off must not send it to the system browser instead. The Shift modifier
 * still wins over forceInApp, so the escape hatch survives.
 */
export function resolveRedmineIssueOpenOptions(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>,
  isMac: boolean,
  worktreeId: string | null,
  forceInApp = false
): OpenHttpLinkOptions {
  const base: OpenHttpLinkOptions = {
    worktreeId,
    sourceOwner: { kind: 'local' },
    ...(forceInApp ? { forceInApp: true } : {})
  }
  return isRedmineSystemBrowserModifier(event, isMac) ? { ...base, modifierHeld: true } : base
}
