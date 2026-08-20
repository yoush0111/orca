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
 */
export function resolveRedmineIssueOpenOptions(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>,
  isMac: boolean,
  worktreeId: string | null
): OpenHttpLinkOptions {
  const base: OpenHttpLinkOptions = { worktreeId, sourceOwner: { kind: 'local' } }
  return isRedmineSystemBrowserModifier(event, isMac) ? { ...base, modifierHeld: true } : base
}
