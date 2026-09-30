import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const REDMINE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['redmine', 'issue', 'show'],
    summary: 'Read a Redmine issue with comments and attachments',
    usage: 'orca redmine issue show <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['orca redmine issue show 5969', 'orca redmine issue show 5969 --json']
  },
  {
    path: ['redmine', 'issue', 'note'],
    summary: 'Add a note (comment) to a Redmine issue',
    usage: 'orca redmine issue note <id> (--body <text> | --body-file <path|->) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'body', 'body-file'],
    positionalArgs: ['id'],
    examples: ['orca redmine issue note 5969 --body-file decision.md --json']
  }
]
