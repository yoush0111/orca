import { describe, expect, it } from 'vitest'
import {
  findExportedSymbolLine,
  findLocalDeclarationLine
} from './import-goto-definition-symbol-lookup'

describe('findLocalDeclarationLine', () => {
  it('finds a local function declaration', () => {
    const content = ['const a = 1', '', 'function helper() {}', 'helper()'].join('\n')
    expect(findLocalDeclarationLine(content, 'helper')).toBe(3)
  })

  it('finds an exported declaration too', () => {
    const content = ['export const CONFIG = {}', 'use(CONFIG)'].join('\n')
    expect(findLocalDeclarationLine(content, 'CONFIG')).toBe(1)
  })

  it('finds an arrow function assigned to a name', () => {
    const content = ['const obj = {', '  render: () => null', '}'].join('\n')
    expect(findLocalDeclarationLine(content, 'render')).toBe(2)
  })

  it('returns null for a name it cannot resolve', () => {
    expect(findLocalDeclarationLine('doSomething(param)', 'param')).toBeNull()
  })
})

describe('findExportedSymbolLine', () => {
  it('finds an exported function declaration', () => {
    const content = ['// header', '', 'export function createThing(): void {}', ''].join('\n')
    expect(findExportedSymbolLine(content, 'createThing')).toBe(3)
  })

  it('finds an exported const', () => {
    const content = ['export const FOO = 1', 'export const BAR = 2'].join('\n')
    expect(findExportedSymbolLine(content, 'BAR')).toBe(2)
  })

  it('finds an exported type', () => {
    const content = ['type Local = 1', 'export type Thing = { a: number }'].join('\n')
    expect(findExportedSymbolLine(content, 'Thing')).toBe(2)
  })

  it('finds a symbol re-exported through an export list', () => {
    const content = ['function helper() {}', '', 'export { helper }'].join('\n')
    // The declaration pattern wins over the export-list pattern; both point at real code.
    expect(findExportedSymbolLine(content, 'helper')).toBe(3)
  })

  it('finds a declaration that is exported further down', () => {
    const content = ['const value = 1', 'somethingElse()', 'export default value'].join('\n')
    expect(findExportedSymbolLine(content, 'value')).toBe(1)
  })

  it('finds the default export', () => {
    const content = ['import x from "y"', '', 'export default function Component() {}'].join('\n')
    expect(findExportedSymbolLine(content, 'default')).toBe(3)
  })

  it('returns null when the symbol is absent', () => {
    expect(findExportedSymbolLine('export const a = 1', 'missing')).toBeNull()
  })

  it('does not match a symbol that only appears as a substring', () => {
    expect(findExportedSymbolLine('export const fooBar = 1', 'foo')).toBeNull()
  })
})
