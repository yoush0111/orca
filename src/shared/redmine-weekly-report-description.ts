// Pulls work items and issue rows out of the in-house Redmine description template. No I/O.
// ponytail: regex over this one CKEditor/Textile template, not a general HTML parser; Node main has no DOMParser.

export type WeeklyReportDescription = {
  /** Work lines, then 이슈/개선 lines, in render order. */
  lines: string[]
  /** Lowercase hex prefixes (7–40 chars) mentioned anywhere in the description. */
  hashes: string[]
  /** Branch names like `feature/x` mentioned anywhere in the description. */
  branches: string[]
}

type Section = { items: string[]; table: string[][] }

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? Number.parseInt(name.slice(2), 16)
          : Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity
    }
    return ENTITIES[name.toLowerCase()] ?? entity
  })
}

function htmlText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

const sectionKey = (title: string): string => title.replace(/[▶\s]/g, '')

function htmlSections(html: string): Map<string, Section> {
  const out = new Map<string, Section>()
  const parts = html.split(/<h3[^>]*>/i).slice(1)
  for (const part of parts) {
    const [title, body = ''] = part.split(/<\/h3>/i)
    const request = body.search(/요청\s*내용/)
    const list = request === -1 ? null : /<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(body.slice(request))
    const items = [...(list?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
      htmlText(m[1])
    )
    const table = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(body)?.[1] ?? ''
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => htmlText(cell[1]))
    )
    out.set(sectionKey(htmlText(title)), { items, table: rows })
  }
  return out
}

/** Textile `h3.` / Markdown `###` headings, `*`/`-` lists, and `|` tables. */
function textSections(text: string): Map<string, Section> {
  const out = new Map<string, Section>()
  let current: Section | null = null
  let inRequest = false
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = /^(?:h3\.|###)\s*(.+)$/.exec(line)
    if (heading) {
      current = { items: [], table: [] }
      out.set(sectionKey(heading[1].replace(/[*_]/g, '')), current)
      inRequest = false
    } else if (current && /요청\s*내용/.test(line)) {
      inRequest = true
    } else if (current && line.startsWith('|')) {
      const cells = line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.replace(/^_\.\s*/, '').trim())
      if (!cells.every((c) => /^:?-+:?$/.test(c))) {
        current.table.push(cells)
      }
    } else if (current && inRequest && /^[*-]\s+/.test(line)) {
      current.items.push(line.replace(/^[*-]\s+/, ''))
    } else if (line) {
      inRequest = false
    }
  }
  return out
}

/** Rows whose 내용 cell is filled, as `{prefix}{내용} → {처리결과}`. */
function tableLines(
  table: readonly string[][],
  prefix: (row: string[], col: (name: string) => number) => string
): string[] {
  const [header = [], ...rows] = table
  const col = (name: string): number => header.findIndex((h) => h.replace(/\s/g, '') === name)
  const content = col('내용')
  const result = col('처리결과')
  if (content === -1) {
    return []
  }
  return rows.flatMap((row) => {
    const text = row[content]?.trim()
    if (!text) {
      return []
    }
    const outcome = result === -1 ? '' : (row[result]?.trim() ?? '')
    return [`${prefix(row, col)}${text}${outcome ? ` → ${outcome}` : ''}`]
  })
}

function plainText(description: string, isHtml: boolean): string {
  return isHtml ? htmlText(description) : description
}

export function extractWeeklyReportDescription(
  description: string | null | undefined
): WeeklyReportDescription {
  if (!description?.trim()) {
    return { lines: [], hashes: [], branches: [] }
  }
  const isHtml = /<h3[\s>]/i.test(description)
  const sections = isHtml ? htmlSections(description) : textSections(description)
  const work = (sections.get('요건')?.items ?? []).filter(
    (item) => item && !item.startsWith('브랜치')
  )
  const errors = tableLines(sections.get('오류')?.table ?? [], () => '이슈: ')
  const reviews = tableLines(sections.get('개선/검토')?.table ?? [], (row, col) => {
    const kind = row[col('유형')]?.trim()
    return kind ? `${kind}: ` : ''
  })
  const text = plainText(description, isHtml)
  // Both a digit and a letter, so words like "defaced" and numbers like 20261026 are skipped.
  const hashes = [...text.matchAll(/\b[\da-f]{7,40}\b/gi)]
    .map((m) => m[0].toLowerCase())
    .filter((h) => /\d/.test(h) && /[a-f]/.test(h))
  const branches = [...text.matchAll(/\b(?:feature|bugfix|hotfix|fix|release)\/[\w./-]*\w/g)].map(
    (m) => m[0]
  )
  return {
    lines: [...work, ...errors, ...reviews],
    hashes: [...new Set(hashes)],
    branches: [...new Set(branches)]
  }
}
