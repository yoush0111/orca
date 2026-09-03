import { describe, expect, it } from 'vitest'
import { resolveImportSpecifierTarget } from './import-goto-definition-resolution'

function pathExistsAmong(existing: string[]) {
  return async (path: string): Promise<boolean> => existing.includes(path)
}

describe('resolveImportSpecifierTarget', () => {
  it('resolves a relative specifier with an omitted extension', async () => {
    const result = await resolveImportSpecifierTarget(
      './foo',
      '/repo/src/bar.ts',
      '/repo',
      pathExistsAmong(['/repo/src/foo.ts'])
    )
    expect(result).toEqual({ absolutePath: '/repo/src/foo.ts', relativePath: 'src/foo.ts' })
  })

  it('resolves a relative specifier to an index file', async () => {
    const result = await resolveImportSpecifierTarget(
      './sub',
      '/repo/src/bar.ts',
      '/repo',
      pathExistsAmong(['/repo/src/sub/index.ts'])
    )
    expect(result?.absolutePath).toBe('/repo/src/sub/index.ts')
  })

  it('resolves a parent-relative specifier', async () => {
    const result = await resolveImportSpecifierTarget(
      '../shared/util',
      '/repo/src/editor/bar.ts',
      '/repo',
      pathExistsAmong(['/repo/src/shared/util.ts'])
    )
    expect(result?.absolutePath).toBe('/repo/src/shared/util.ts')
  })

  it('resolves the "@/*" alias against the worktree root', async () => {
    const result = await resolveImportSpecifierTarget(
      '@/store',
      '/repo/src/renderer/src/components/editor/Foo.tsx',
      '/repo',
      pathExistsAmong(['/repo/src/renderer/src/store.ts'])
    )
    expect(result).toEqual({
      absolutePath: '/repo/src/renderer/src/store.ts',
      relativePath: 'src/renderer/src/store.ts'
    })
  })

  it('returns null when no candidate exists', async () => {
    const result = await resolveImportSpecifierTarget(
      './missing',
      '/repo/src/bar.ts',
      '/repo',
      pathExistsAmong([])
    )
    expect(result).toBeNull()
  })

  it('returns null for an alias specifier with no worktree root', async () => {
    const result = await resolveImportSpecifierTarget(
      '@/store',
      '/repo/src/bar.ts',
      null,
      pathExistsAmong(['/repo/src/renderer/src/store.ts'])
    )
    expect(result).toBeNull()
  })
})
