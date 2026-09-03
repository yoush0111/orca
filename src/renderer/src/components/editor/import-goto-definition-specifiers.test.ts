import { describe, expect, it } from 'vitest'
import {
  findImportSpecifierRanges,
  findImportSymbolRanges
} from './import-goto-definition-specifiers'

describe('findImportSymbolRanges', () => {
  it('finds a named import symbol with its range', () => {
    const matches = findImportSymbolRanges("import { foo } from './foo'\n")
    expect(matches).toEqual([
      {
        specifier: './foo',
        symbol: 'foo',
        range: { startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 13 }
      }
    ])
  })

  it('treats an import outside braces as the default export', () => {
    const matches = findImportSymbolRanges("import Foo from './foo'\n")
    expect(matches.map((m) => [m.symbol, m.specifier])).toEqual([['default', './foo']])
  })

  it('uses the exported name, not the local alias', () => {
    const matches = findImportSymbolRanges("import { foo as bar } from './foo'\n")
    expect(matches.map((m) => m.symbol)).toEqual(['foo'])
  })

  it('ignores the `type` modifier', () => {
    const matches = findImportSymbolRanges("import type { Thing } from './types'\n")
    expect(matches.map((m) => m.symbol)).toEqual(['Thing'])
  })

  it('skips namespace imports (no single exported symbol)', () => {
    const matches = findImportSymbolRanges("import * as ns from './foo'\n")
    expect(matches).toEqual([])
  })

  it('finds symbols in a multi-line import clause with correct line numbers', () => {
    const content = ['import {', '  alpha,', '  beta', "} from './foo'", ''].join('\n')
    const matches = findImportSymbolRanges(content)
    expect(matches.map((m) => [m.symbol, m.range.startLineNumber, m.range.startColumn])).toEqual([
      ['alpha', 2, 3],
      ['beta', 3, 3]
    ])
  })

  it('finds re-exported symbols', () => {
    const matches = findImportSymbolRanges("export { foo } from './foo'\n")
    expect(matches.map((m) => m.symbol)).toEqual(['foo'])
  })

  it('ignores bare package specifiers', () => {
    expect(findImportSymbolRanges("import { useState } from 'react'\n")).toEqual([])
  })
})

describe('findImportSpecifierRanges', () => {
  it('finds a relative import specifier from a named import', () => {
    const matches = findImportSpecifierRanges("import { foo } from './foo'\n")
    expect(matches).toEqual([
      {
        specifier: './foo',
        range: { startLineNumber: 1, startColumn: 22, endLineNumber: 1, endColumn: 27 }
      }
    ])
  })

  it('finds an alias import specifier', () => {
    const matches = findImportSpecifierRanges("import { useAppStore } from '@/store'\n")
    expect(matches.map((m) => m.specifier)).toEqual(['@/store'])
  })

  it('finds a side-effect import with no `from`', () => {
    const matches = findImportSpecifierRanges("import './setup'\n")
    expect(matches.map((m) => m.specifier)).toEqual(['./setup'])
  })

  it('finds a require() specifier', () => {
    const matches = findImportSpecifierRanges("const x = require('../shared/util')\n")
    expect(matches.map((m) => m.specifier)).toEqual(['../shared/util'])
  })

  it('finds a dynamic import() specifier', () => {
    const matches = findImportSpecifierRanges("const x = import('./lazy')\n")
    expect(matches.map((m) => m.specifier)).toEqual(['./lazy'])
  })

  it('finds an export-from specifier', () => {
    const matches = findImportSpecifierRanges("export { foo } from './foo'\n")
    expect(matches.map((m) => m.specifier)).toEqual(['./foo'])
  })

  it('ignores bare package specifiers', () => {
    const matches = findImportSpecifierRanges("import React from 'react'\n")
    expect(matches).toEqual([])
  })

  it('finds specifiers on separate lines with correct line numbers', () => {
    const matches = findImportSpecifierRanges("import a from './a'\nimport b from './b'\n")
    expect(matches.map((m) => [m.range.startLineNumber, m.specifier])).toEqual([
      [1, './a'],
      [2, './b']
    ])
  })
})
