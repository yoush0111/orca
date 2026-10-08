import { describe, expect, it } from 'vitest'
import {
  classifyJavaClick,
  findJavaMethodDeclarationLine,
  findJavaTypeDeclarationLine,
  inferJavaVariableType,
  parseJavaImports,
  parseJavaPackage
} from './java-goto-definition-parsing'

function clickOn(lineText: string, word: string, occurrence = 0) {
  let start = -1
  for (let i = 0; i <= occurrence; i++) {
    start = lineText.indexOf(word, start + 1)
  }
  return classifyJavaClick(lineText, start, start + word.length)
}

describe('parseJavaPackage / parseJavaImports', () => {
  it('reads the package and imports', () => {
    const content = [
      'package com.acme.app;',
      'import com.acme.model.User;',
      'import static com.acme.util.Strings.trim;',
      'import java.util.*;'
    ].join('\n')
    expect(parseJavaPackage(content)).toBe('com.acme.app')
    expect(parseJavaImports(content)).toEqual([
      { path: 'com.acme.model.User', isStatic: false, isWildcard: false },
      { path: 'com.acme.util.Strings.trim', isStatic: true, isWildcard: false },
      { path: 'java.util', isStatic: false, isWildcard: true }
    ])
  })
})

describe('classifyJavaClick', () => {
  it('classifies import lines', () => {
    expect(clickOn('import com.acme.model.User;', 'User')).toEqual({
      kind: 'import',
      classFqn: 'com.acme.model.User',
      member: null
    })
    expect(clickOn('import static com.acme.Strings.trim;', 'trim')).toEqual({
      kind: 'import',
      classFqn: 'com.acme.Strings',
      member: 'trim'
    })
    expect(clickOn('import java.util.*;', 'util')).toBeNull()
  })

  it('classifies type names and constructors', () => {
    expect(clickOn('    User user = new User();', 'User')).toEqual({ kind: 'type', name: 'User' })
    expect(clickOn('    User user = new User();', 'User', 1)).toEqual({
      kind: 'type',
      name: 'User'
    })
  })

  it('classifies method calls with and without receivers', () => {
    expect(clickOn('    save(user);', 'save')).toEqual({
      kind: 'method',
      name: 'save',
      receiver: null
    })
    expect(clickOn('    this.save(user);', 'save')).toEqual({
      kind: 'method',
      name: 'save',
      receiver: null
    })
    expect(clickOn('    repo.save(user);', 'save')).toEqual({
      kind: 'method',
      name: 'save',
      receiver: 'repo'
    })
    expect(clickOn('    x = Strings.trim(s);', 'trim')).toEqual({
      kind: 'method',
      name: 'trim',
      receiver: 'Strings'
    })
  })

  it('returns null for chains, super, and plain lowercase words', () => {
    expect(clickOn('    a.b.save(user);', 'save')).toBeNull()
    expect(clickOn('    find().save(user);', 'save')).toBeNull()
    expect(clickOn('    super.save(user);', 'save')).toBeNull()
    expect(clickOn('    int count = 0;', 'count')).toBeNull()
  })
})

describe('findJavaTypeDeclarationLine', () => {
  it('finds classes, interfaces and annotated declarations', () => {
    const content = ['package a;', '', '@Service', 'public final class UserService {', '}'].join(
      '\n'
    )
    expect(findJavaTypeDeclarationLine(content, 'UserService')).toBe(4)
    expect(findJavaTypeDeclarationLine('interface Repo {}', 'Repo')).toBe(1)
    expect(findJavaTypeDeclarationLine('class RepoImpl {}', 'Repo')).toBeNull()
  })
})

describe('findJavaMethodDeclarationLine', () => {
  const content = [
    'public class UserService {',
    '  public User find(long id) {',
    '    return save(new User());',
    '  }',
    '  @Override public static <T> List<T> save(T value) {',
    '    return null;',
    '  }',
    '  void run();',
    '}'
  ].join('\n')

  it('finds declarations with modifiers, generics and inline annotations', () => {
    expect(findJavaMethodDeclarationLine(content, 'find')).toBe(2)
    expect(findJavaMethodDeclarationLine(content, 'save')).toBe(5)
    expect(findJavaMethodDeclarationLine(content, 'run')).toBe(8)
  })

  it('ignores call sites', () => {
    expect(
      findJavaMethodDeclarationLine('    return save(x);\n    foo = bar(1);', 'save')
    ).toBeNull()
    expect(findJavaMethodDeclarationLine('    foo = bar(1);', 'bar')).toBeNull()
  })
})

describe('inferJavaVariableType', () => {
  const content = [
    'class A {',
    '  private final UserRepository repo;',
    '  private Map<String, List<User>> cache = new HashMap<>();',
    '  void run(Order order) {',
    '    Helper repo = new Helper();',
    '    repo.go();',
    '    for (Item item : items) {}',
    '  }',
    '  void other() { repo.go(); }',
    '}'
  ].join('\n')

  it('prefers the nearest preceding declaration', () => {
    expect(inferJavaVariableType(content, 'repo', content.indexOf('repo.go'))).toBe('Helper')
    expect(inferJavaVariableType(content, 'repo', content.indexOf('repo;'))).toBe('UserRepository')
  })

  it('handles parameters, generics and for-each variables', () => {
    const end = content.length
    expect(inferJavaVariableType(content, 'order', end)).toBe('Order')
    expect(inferJavaVariableType(content, 'cache', end)).toBe('Map')
    expect(inferJavaVariableType(content, 'item', end)).toBe('Item')
  })

  it('falls back to a later declaration and returns null when undeclared', () => {
    expect(inferJavaVariableType('x.go();\nFoo x;', 'x', 0)).toBe('Foo')
    expect(inferJavaVariableType(content, 'missing', 0)).toBeNull()
    expect(inferJavaVariableType('var x = make();', 'x', 99)).toBeNull()
  })
})
