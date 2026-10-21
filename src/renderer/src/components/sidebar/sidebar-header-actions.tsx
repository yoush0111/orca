import React, { useCallback, useMemo } from 'react'
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatOptionalPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { openWorkspaceCreationComposerWithTourHandoff } from '../contextual-tours/workspace-creation-tour-handoff'
import SidebarWorkspaceOptionsMenu from './SidebarWorkspaceOptionsMenu'
import { getSidebarHeaderCollapseKeys } from './collapse-all-sidebar-groups'

function areAllHeadersCollapsed(keys: readonly string[], collapsedGroups: Set<string>): boolean {
  return keys.length > 0 && keys.every((key) => collapsedGroups.has(key))
}

function ToggleAllProjectsCollapsedButton(): React.JSX.Element {
  const collapsedGroups = useAppStore((s) => s.collapsedGroups)
  // ponytail: recomputed only on collapse changes, so a project added meanwhile can show a stale icon until the next toggle; the click itself always reads fresh state.
  const allCollapsed = useMemo(
    () =>
      areAllHeadersCollapsed(getSidebarHeaderCollapseKeys(useAppStore.getState()), collapsedGroups),
    [collapsedGroups]
  )
  const label = allCollapsed
    ? translate('auto.components.sidebar.SidebarHeader.expandAll', 'Expand all projects')
    : translate('auto.components.sidebar.SidebarHeader.collapseAll', 'Collapse all projects')
  const Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp

  const handleClick = useCallback(() => {
    const state = useAppStore.getState()
    const keys = getSidebarHeaderCollapseKeys(state)
    state.setGroupsCollapsed(keys, !areAllHeadersCollapsed(keys, state.collapsedGroups))
  }, [])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          onClick={handleClick}
        >
          <Icon className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function AddProjectButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const label = translate('auto.components.sidebar.SidebarHeader.addProject', 'Add project')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          onClick={() => openModal('add-repo')}
        >
          <FolderPlus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NewWorkspaceButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const keybindings = useAppStore((s) => s.keybindings)
  // Why primary: workspace.create binds both Mod+N and Mod+Shift+N, and listing
  // every alias in a one-line tooltip reads as noise rather than help.
  const shortcutLabel = formatOptionalPrimaryShortcutLabel('workspace.create', keybindings)
  const label = translate('auto.components.sidebar.SidebarHeader.92154beb7e', 'New workspace')

  // Why the tour handoff here: the tour highlights this button, and it is now
  // the control that performs the action rather than one that opens a menu.
  const handleCreateWorkspace = useCallback(() => {
    openWorkspaceCreationComposerWithTourHandoff()
  }, [])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          data-contextual-tour-target="workspace-create-control"
          onClick={handleCreateWorkspace}
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        {shortcutLabel ? <span className="ml-1.5 text-background/60">{shortcutLabel}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function SidebarHeaderActions({
  onWorkspaceBoardMenuOpenChange,
  agentsViewActive = false
}: {
  onWorkspaceBoardMenuOpenChange: (open: boolean) => void
  agentsViewActive?: boolean
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1" data-sidebar-header-actions="">
      {/* Why only options swap: the activity view portals its own options button into this slot
          (SidebarHeader), and keeping Add project means no header button shifts between views. */}
      {agentsViewActive ? null : (
        <SidebarWorkspaceOptionsMenu
          preserveWorkspaceBoardOpen
          onMenuOpenChange={onWorkspaceBoardMenuOpenChange}
        />
      )}
      {agentsViewActive ? null : <ToggleAllProjectsCollapsedButton />}
      <AddProjectButton preserveWorkspaceBoardOpen />
      <NewWorkspaceButton preserveWorkspaceBoardOpen />
    </div>
  )
}
