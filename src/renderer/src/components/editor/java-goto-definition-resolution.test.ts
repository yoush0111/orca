import { describe, expect, it } from 'vitest'
import {
  javaSourceRoots,
  javaTypeFqnCandidates,
  resolveJavaDefinitionTarget,
  type JavaResolveDeps
} from './java-goto-definition-resolution'

const ROOT = '/repo'
const MAIN = '/repo/src/main/java'

function depsFor(files: Record<string, string>, filePath: string): JavaResolveDeps {
  return {
    filePath,
    worktreeRoot: ROOT,
    pathExists: async (path) => path in files,
    readFile: async (path) => files[path] ?? null
  }
}

describe('javaSourceRoots', () => {
  it('derives the own root from the package plus its test sibling and worktree roots', () => {
    expect(javaSourceRoots(`${MAIN}/com/acme/App.java`, 'com.acme', ROOT)).toEqual([
      MAIN,
      '/repo/src/test/java'
    ])
  })

  it('works for a module root and a file without package', () => {
    expect(javaSourceRoots('/repo/core/src/test/java/a/T.java', 'a', ROOT)).toEqual([
      '/repo/core/src/test/java',
      '/repo/core/src/main/java',
      MAIN,
      '/repo/src/test/java'
    ])
    expect(javaSourceRoots('/repo/Main.java', null, null)).toEqual(['/repo'])
  })

  it('handles Windows paths', () => {
    expect(javaSourceRoots('C:\\repo\\src\\main\\java\\a\\App.java', 'a', null)).toEqual([
      'C:/repo/src/main/java',
      'C:/repo/src/test/java'
    ])
  })
})

describe('javaTypeFqnCandidates', () => {
  const content = ['package com.acme;', 'import com.lib.User;', 'import org.x.*;'].join('\n')

  it('uses the explicit import when present', () => {
    expect(javaTypeFqnCandidates(content, 'User')).toEqual(['com.lib.User'])
  })

  it('tries the same package then wildcard imports', () => {
    expect(javaTypeFqnCandidates(content, 'Order')).toEqual(['com.acme.Order', 'org.x.Order'])
  })
})

describe('resolveJavaDefinitionTarget', () => {
  const appPath = `${MAIN}/com/acme/App.java`
  const app = [
    'package com.acme;',
    'import com.acme.repo.UserRepository;',
    'import static com.acme.util.Strings.trim;',
    'public class App {',
    '  private UserRepository repo;',
    '  void run(String name) {',
    '    repo.save(name);',
    '    Strings.trim(name);',
    '    helper();',
    '    name.length();',
    '  }',
    '  private void helper() {}',
    '}'
  ].join('\n')
  const files = {
    [appPath]: app,
    [`${MAIN}/com/acme/repo/UserRepository.java`]: [
      'package com.acme.repo;',
      'public interface UserRepository {',
      '  void save(String name);',
      '}'
    ].join('\n'),
    [`${MAIN}/com/acme/Strings.java`]: [
      'package com.acme;',
      'public class Strings {',
      '  public static String trim(String s) { return s; }',
      '}'
    ].join('\n')
  }
  const deps = depsFor(files, appPath)
  const resolve = (click: Parameters<typeof resolveJavaDefinitionTarget>[2], marker = '') =>
    resolveJavaDefinitionTarget(app, app.indexOf(marker), click, deps)

  it('opens an imported class at its declaration', async () => {
    expect(
      await resolve({ kind: 'import', classFqn: 'com.acme.repo.UserRepository', member: null })
    ).toEqual({
      kind: 'file',
      absolutePath: `${MAIN}/com/acme/repo/UserRepository.java`,
      relativePath: 'src/main/java/com/acme/repo/UserRepository.java',
      line: 2
    })
  })

  it('resolves a same-package class by name', async () => {
    expect(await resolve({ kind: 'type', name: 'Strings' })).toMatchObject({
      kind: 'file',
      absolutePath: `${MAIN}/com/acme/Strings.java`,
      line: 2
    })
  })

  it('jumps to same-file methods and types', async () => {
    expect(await resolve({ kind: 'method', name: 'helper', receiver: null })).toEqual({
      kind: 'same-file',
      line: 12
    })
    expect(await resolve({ kind: 'type', name: 'App' })).toEqual({ kind: 'same-file', line: 4 })
  })

  it('infers the field type for an instance call', async () => {
    expect(
      await resolve({ kind: 'method', name: 'save', receiver: 'repo' }, 'repo.save')
    ).toMatchObject({ absolutePath: `${MAIN}/com/acme/repo/UserRepository.java`, line: 3 })
  })

  it('resolves a static call on a type name', async () => {
    expect(
      await resolve({ kind: 'method', name: 'trim', receiver: 'Strings' }, 'Strings.trim')
    ).toMatchObject({ absolutePath: `${MAIN}/com/acme/Strings.java`, line: 3 })
  })

  it('returns null when the type or declaration cannot be found', async () => {
    expect(
      await resolve({ kind: 'method', name: 'length', receiver: 'name' }, 'name.length')
    ).toBeNull()
    expect(
      await resolve({ kind: 'method', name: 'missing', receiver: 'repo' }, 'repo.save')
    ).toBeNull()
    expect(
      await resolve({ kind: 'method', name: 'x', receiver: 'unknown' }, 'repo.save')
    ).toBeNull()
    expect(await resolve({ kind: 'type', name: 'Nope' })).toBeNull()
  })
})
