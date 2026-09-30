import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { RedmineAgentSkillStatus } from '../../shared/redmine-types'
import { REDMINE_AGENT_SKILL_MARKDOWN } from './agent-skill-stub'

function skillPath(homeDir: string): string {
  return join(homeDir, '.claude', 'skills', 'orca-redmine', 'SKILL.md')
}

export function getRedmineAgentSkillStatus(homeDir: string = homedir()): RedmineAgentSkillStatus {
  const path = skillPath(homeDir)
  if (!existsSync(path)) {
    return 'missing'
  }
  // Why: normalize CRLF so a Windows editor re-save isn't reported as outdated.
  const current = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  return current === REDMINE_AGENT_SKILL_MARKDOWN ? 'installed' : 'outdated'
}

export function installRedmineAgentSkill(homeDir: string = homedir()): RedmineAgentSkillStatus {
  const path = skillPath(homeDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, REDMINE_AGENT_SKILL_MARKDOWN, 'utf8')
  return getRedmineAgentSkillStatus(homeDir)
}
