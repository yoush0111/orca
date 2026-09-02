export function RedmineIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {/* Why: Redmine ships no monochrome mark, so approximate its diamond
      cluster as flat geometry that matches Orca's other provider icons. */}
      <path d="M12 1.5 18.5 8 12 14.5 5.5 8 12 1.5Zm0 3.4L8.9 8l3.1 3.1L15.1 8 12 4.9Z" />
      <path d="m6.2 12.6 4 4-3 3-4-4 3-3Zm11.6 0 3 3-4 4-3-3 4-4Z" />
    </svg>
  )
}
