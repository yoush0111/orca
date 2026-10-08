import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  WEEKLY_REPORT_DATE_FORMATS,
  WEEKLY_REPORT_PLACEHOLDERS,
  type WeeklyReportFormat
} from '../../../shared/redmine-weekly-report-format'

type FormatPanelProps = {
  format: WeeklyReportFormat
  onChange: (next: WeeklyReportFormat) => void
  onReset: () => void
}

type TemplateKey = 'projectTemplate' | 'trackerTemplate' | 'issueTemplate' | 'commentTemplate'
type FlagKey =
  | 'stripTrackerTags'
  | 'includeComments'
  | 'includeOthersComments'
  | 'includePrivateNotes'

// A single-line input cannot hold a tab keystroke, so tabs are edited as a visible `\t`.
const toEditable = (template: string): string => template.replace(/\t/g, '\\t')
const fromEditable = (value: string): string => value.replace(/\\t/g, '\t')

function TemplateField({
  label,
  placeholders,
  value,
  onChange
}: {
  label: string
  placeholders: readonly string[]
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={toEditable(value)}
        onChange={(e) => onChange(fromEditable(e.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        {placeholders.map((name) => `{${name}}`).join(' ')}
      </p>
    </div>
  )
}

function FlagField({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}

/** Text that only commits on blur, so partial input like "신규기능, " is not reparsed mid-typing. */
function DraftInput({
  id,
  value,
  type,
  onCommit
}: {
  id: string
  value: string
  type?: 'number'
  onCommit: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }
  return (
    <Input
      id={id}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
    />
  )
}

export function TaskPageRedmineWeeklyReportFormatPanel({
  format,
  onChange,
  onReset
}: FormatPanelProps): React.JSX.Element {
  const dateId = useId()
  const orderId = useId()
  const maxId = useId()
  const set = <K extends keyof WeeklyReportFormat>(key: K, value: WeeklyReportFormat[K]): void =>
    onChange({ ...format, [key]: value })
  const templates: { key: TemplateKey; label: string; placeholders: readonly string[] }[] = [
    {
      key: 'projectTemplate',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.projectTemplate',
        'Project line'
      ),
      placeholders: WEEKLY_REPORT_PLACEHOLDERS.project
    },
    {
      key: 'trackerTemplate',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.trackerTemplate',
        'Tracker line'
      ),
      placeholders: WEEKLY_REPORT_PLACEHOLDERS.tracker
    },
    {
      key: 'issueTemplate',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.issueTemplate',
        'Issue line'
      ),
      placeholders: WEEKLY_REPORT_PLACEHOLDERS.issue
    },
    {
      key: 'commentTemplate',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.commentTemplate',
        'Comment line'
      ),
      placeholders: WEEKLY_REPORT_PLACEHOLDERS.comment
    }
  ]
  const flags: { key: FlagKey; label: string }[] = [
    {
      key: 'stripTrackerTags',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.stripTrackerTags',
        'Remove tracker tags like [Bug] from subjects'
      )
    },
    {
      key: 'includeComments',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.includeComments',
        'Include comments'
      )
    },
    {
      key: 'includeOthersComments',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.includeOthersComments',
        "Include other people's comments"
      )
    },
    {
      key: 'includePrivateNotes',
      label: translate(
        'auto.components.task.page.redmine.weekly.report.format.includePrivateNotes',
        'Include private notes'
      )
    }
  ]

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group">
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          {translate(
            'auto.components.task.page.redmine.weekly.report.format.toggle',
            'Format settings'
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3 rounded-md border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.task.page.redmine.weekly.report.format.hint',
              'Changes apply to the preview right away and are remembered. Type \\t for a tab.'
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((field) => (
              <TemplateField
                key={field.key}
                label={field.label}
                placeholders={field.placeholders}
                value={format[field.key]}
                onChange={(value) => set(field.key, value)}
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={dateId}>
                {translate(
                  'auto.components.task.page.redmine.weekly.report.format.dateFormat',
                  'Date format'
                )}
              </Label>
              <Select
                value={format.dateFormat}
                onValueChange={(value) => {
                  const next = WEEKLY_REPORT_DATE_FORMATS.find((f) => f === value)
                  if (next) {
                    set('dateFormat', next)
                  }
                }}
              >
                <SelectTrigger id={dateId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKLY_REPORT_DATE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={orderId}>
                {translate(
                  'auto.components.task.page.redmine.weekly.report.format.trackerOrder',
                  'Tracker order (comma separated)'
                )}
              </Label>
              <DraftInput
                id={orderId}
                value={format.trackerOrder.join(', ')}
                onCommit={(value) =>
                  set(
                    'trackerOrder',
                    value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={maxId}>
                {translate(
                  'auto.components.task.page.redmine.weekly.report.format.commentMaxChars',
                  'Comment max length'
                )}
              </Label>
              <DraftInput
                id={maxId}
                type="number"
                value={String(format.commentMaxChars)}
                onCommit={(value) => {
                  const next = Number(value)
                  set(
                    'commentMaxChars',
                    Number.isInteger(next)
                      ? Math.min(1000, Math.max(10, next))
                      : format.commentMaxChars
                  )
                }}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {flags.map((flag) => (
              <FlagField
                key={flag.key}
                label={flag.label}
                checked={format[flag.key]}
                onChange={(checked) => set(flag.key, checked)}
              />
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            {translate(
              'auto.components.task.page.redmine.weekly.report.format.reset',
              'Restore defaults'
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
