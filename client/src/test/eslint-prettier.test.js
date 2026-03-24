// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

const clientRoot = resolve(import.meta.dirname, '..', '..')

describe('ESLint and Prettier configuration', () => {
  it('.eslintrc.cjs exists with correct structure', () => {
    const configPath = resolve(clientRoot, '.eslintrc.cjs')
    expect(existsSync(configPath)).toBe(true)
    const content = readFileSync(configPath, 'utf-8')
    expect(content).toContain('plugin:react/recommended')
    expect(content).toContain('plugin:react-hooks/recommended')
    expect(content).toContain('prettier')
    expect(content).toContain('no-restricted-syntax')
    expect(content).toContain('no-hardcoded-hex')
  })

  it('.prettierrc exists with correct settings', () => {
    const configPath = resolve(clientRoot, '.prettierrc')
    expect(existsSync(configPath)).toBe(true)
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(config.singleQuote).toBe(true)
    expect(config.trailingComma).toBe('all')
    expect(config.tabWidth).toBe(2)
  })

  it('package.json has lint and format scripts', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(clientRoot, 'package.json'), 'utf-8'),
    )
    expect(pkg.scripts.lint).toBeDefined()
    expect(pkg.scripts.format).toBeDefined()
    expect(pkg.scripts.lint).toContain('eslint')
    expect(pkg.scripts.format).toContain('prettier')
  })

  it('custom no-hardcoded-hex rule plugin exists', () => {
    const rulePath = resolve(clientRoot, 'eslint-rules', 'no-hardcoded-hex.cjs')
    expect(existsSync(rulePath)).toBe(true)
    const content = readFileSync(rulePath, 'utf-8')
    expect(content).toContain('#[0-9a-fA-F]')
  })

  it('npm run lint passes on clean codebase', () => {
    execSync('npm run lint', {
      cwd: clientRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // If we get here without throwing, lint passed
    expect(true).toBe(true)
  })

  it('npm run format:check passes on clean codebase', () => {
    execSync('npm run format:check', {
      cwd: clientRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    expect(true).toBe(true)
  })

  it('ESLint catches inline style attributes', () => {
    // Create a temporary test file with inline style violation
    const testCode = `function Bad() {
  return <div style={{ color: 'red' }}>test</div>
}
export default Bad
`
    const tempFile = resolve(clientRoot, 'src', '__lint_test_inline.jsx')
    writeFileSync(tempFile, testCode)

    try {
      execSync(`npx eslint "${tempFile}"`, {
        cwd: clientRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      // Should not reach here — lint should fail
      expect.unreachable('ESLint should have flagged inline style')
    } catch (error) {
      expect(error.stdout || error.stderr).toContain(
        'Inline styles are not allowed',
      )
    } finally {
      unlinkSync(tempFile)
    }
  })

  it('ESLint catches hardcoded hex colors in className', () => {
    const testCode = `function Bad() {
  return <div className="text-[#c9a227]">test</div>
}
export default Bad
`
    const tempFile = resolve(clientRoot, 'src', '__lint_test_hex.jsx')
    writeFileSync(tempFile, testCode)

    try {
      execSync(`npx eslint "${tempFile}"`, {
        cwd: clientRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      expect.unreachable('ESLint should have flagged hardcoded hex')
    } catch (error) {
      expect(error.stdout || error.stderr).toContain('Hardcoded hex color')
    } finally {
      unlinkSync(tempFile)
    }
  })

  it('ESLint catches style={{ color: "#ff0000" }} with hex', () => {
    const testCode = `function Bad() {
  return <div style={{ color: '#ff0000' }}>test</div>
}
export default Bad
`
    const tempFile = resolve(clientRoot, 'src', '__lint_test_style_hex.jsx')
    writeFileSync(tempFile, testCode)

    try {
      execSync(`npx eslint "${tempFile}"`, {
        cwd: clientRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      expect.unreachable('ESLint should have flagged both style and hex')
    } catch (error) {
      const output = error.stdout || error.stderr
      expect(output).toContain('Inline styles are not allowed')
      expect(output).toContain('Hardcoded hex color')
    } finally {
      unlinkSync(tempFile)
    }
  })
})
