import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REDMINE_AGENT_SKILL_MARKDOWN } from './agent-skill-stub'
import { getRedmineAgentSkillStatus, installRedmineAgentSkill } from './agent-skill-install'

const skillFile = (home: string): string =>
  join(home, '.claude', 'skills', 'orca-redmine', 'SKILL.md')

describe('redmine agent skill install', () => {
  it('matches the repository stub', () => {
    const source = readFileSync(join(process.cwd(), 'skills', 'orca-redmine', 'SKILL.md'), 'utf8')
    expect(REDMINE_AGENT_SKILL_MARKDOWN).toBe(source.replace(/\r\n/g, '\n'))
  })

  it('goes missing → installed → outdated → installed', () => {
    const home = mkdtempSync(join(tmpdir(), 'orca-rm-skill-'))
    expect(getRedmineAgentSkillStatus(home)).toBe('missing')

    expect(installRedmineAgentSkill(home)).toBe('installed')
    expect(readFileSync(skillFile(home), 'utf8')).toBe(REDMINE_AGENT_SKILL_MARKDOWN)

    writeFileSync(skillFile(home), 'old')
    expect(getRedmineAgentSkillStatus(home)).toBe('outdated')
    expect(installRedmineAgentSkill(home)).toBe('installed')
  })
})
