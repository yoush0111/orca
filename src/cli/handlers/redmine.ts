import type { RedmineIssueDetail } from '../../shared/redmine-types'
import type { CommandHandler } from '../dispatch'
import { getOptionalPositiveIntegerFlag } from '../flags'
import { printResult } from '../format'
import { readLinearBody } from '../linear-request-builders'
import { formatRedmineIssue, formatRedmineNoteAdded } from '../redmine-format'
import { RuntimeClientError } from '../runtime-client'

function getRequiredIssueId(flags: Map<string, string | boolean>): number {
  const id = getOptionalPositiveIntegerFlag(flags, 'id')
  if (id === undefined) {
    throw new RuntimeClientError('invalid_argument', 'Missing Redmine issue id')
  }
  return id
}

export const REDMINE_HANDLERS: Record<string, CommandHandler> = {
  'redmine issue show': async ({ flags, client, json }) => {
    const response = await client.call<RedmineIssueDetail>('redmine.issueShow', {
      id: getRequiredIssueId(flags)
    })
    printResult(response, json, formatRedmineIssue)
  },
  'redmine issue note': async ({ flags, client, cwd, json }) => {
    const id = getRequiredIssueId(flags)
    // ponytail: reuses Linear's body reader (stdin/file/cap); split it out if Redmine needs its own rules.
    const notes = await readLinearBody(flags, cwd, { required: true })
    const response = await client.call<{ ok: true; id: number }>('redmine.issueAddNote', {
      id,
      notes
    })
    printResult(response, json, formatRedmineNoteAdded)
  }
}
