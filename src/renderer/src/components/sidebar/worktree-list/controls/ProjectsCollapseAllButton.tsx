import React from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'

export function ProjectsCollapseAllButton({
  allCollapsed,
  onToggle
}: {
  allCollapsed: boolean
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const shortcut = useShortcutKeyDetails('sidebar.projects.toggleCollapse')
  const label = allCollapsed
    ? t('auto.components.sidebar.SidebarHeader.expandAllProjects', 'Expand all projects')
    : t('auto.components.sidebar.SidebarHeader.collapseAllProjects', 'Collapse all projects')
  const Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp

  // Own provider so a tooltip open on a neighbor can't skip this delay; clicks are the common case.
  return (
    <TooltipProvider delayDuration={1000} skipDelayDuration={0}>
      <Tooltip>
        <span data-projects-collapse-toggle="" className="flex shrink-0 text-muted-foreground">
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={label}
              onClick={onToggle}
            >
              <Icon className="size-3.5" strokeWidth={2.25} />
            </Button>
          </TooltipTrigger>
        </span>
        <TooltipContent side="bottom" sideOffset={6}>
          <span className="flex items-center gap-2">
            {label}
            <ShortcutKeyCombo {...shortcut} />
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
