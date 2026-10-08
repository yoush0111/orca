// Weekly report Markdown → HTML for pasting into Slack, which ignores pasted Markdown.

type HtmlBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: { text: string; children: string[] }[] }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
}

function toHtmlBlocks(markdown: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = []
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const last = blocks.at(-1)
    const child = /^(?:\t+| {2,})[-*] (.*)$/.exec(line)
    const item = /^[-*] (.*)$/.exec(line)
    if (child && last?.kind === 'ul' && last.items.length > 0) {
      last.items.at(-1)?.children.push(child[1])
    } else if (item || child) {
      const entry = { text: (item ?? child)?.[1] ?? '', children: [] }
      if (last?.kind === 'ul') {
        last.items.push(entry)
      } else {
        blocks.push({ kind: 'ul', items: [entry] })
      }
    } else if (line.trim()) {
      blocks.push({ kind: 'p', text: line.trim() })
    }
  }
  return blocks
}

/** Slack renders pasted HTML (not Markdown), so "Copy for Slack" puts this on the clipboard. */
export function weeklyReportMarkdownToHtml(markdown: string): string {
  return toHtmlBlocks(markdown)
    .map((block) =>
      block.kind === 'p'
        ? `<p>${inlineHtml(block.text)}</p>`
        : `<ul>${block.items
            .map((entry) => {
              const nested = entry.children.length
                ? `<ul>${entry.children.map((c) => `<li>${inlineHtml(c)}</li>`).join('')}</ul>`
                : ''
              return `<li>${inlineHtml(entry.text)}${nested}</li>`
            })
            .join('')}</ul>`
    )
    .join('')
}
