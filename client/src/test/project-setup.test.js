import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const clientRoot = resolve(import.meta.dirname, '..', '..')

describe('Project setup', () => {
  it('has no tailwind.config.js file', () => {
    expect(existsSync(resolve(clientRoot, 'tailwind.config.js'))).toBe(false)
    expect(existsSync(resolve(clientRoot, '..', 'tailwind.config.js'))).toBe(
      false,
    )
  })

  it('app.css contains @theme block', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain('@theme {')
  })

  it('app.css contains @import "tailwindcss"', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain('@import "tailwindcss"')
  })

  it('app.css defines oxford-blue color', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain('--color-oxford-blue: #0a0a12')
  })

  it('app.css defines ivory color', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain('--color-ivory: #f3f4f6')
  })

  it('app.css defines amber color', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain('--color-amber: #c9a227')
  })

  it('app.css defines font families', () => {
    const css = readFileSync(resolve(clientRoot, 'src/styles/app.css'), 'utf-8')
    expect(css).toContain("--font-heading: 'Playfair Display'")
    expect(css).toContain("--font-body: 'Source Sans 3'")
    expect(css).toContain("--font-mono: 'JetBrains Mono'")
  })

  it('index.html includes Google Fonts', () => {
    const html = readFileSync(resolve(clientRoot, 'index.html'), 'utf-8')
    expect(html).toContain('Playfair+Display')
    expect(html).toContain('Source+Sans+3')
    expect(html).toContain('JetBrains+Mono')
  })

  it('index.html has correct meta tags', () => {
    const html = readFileSync(resolve(clientRoot, 'index.html'), 'utf-8')
    expect(html).toContain('name="theme-color" content="#0a0a12"')
    expect(html).toContain('The Virtual Concertmaster')
    expect(html).toContain('name="description"')
  })

  it('vite.config.js proxies /api to Express backend', () => {
    const config = readFileSync(resolve(clientRoot, 'vite.config.js'), 'utf-8')
    expect(config).toContain("'/api'")
    expect(config).toContain('http://localhost:3000')
  })

  it('vite.config.js uses @tailwindcss/vite plugin', () => {
    const config = readFileSync(resolve(clientRoot, 'vite.config.js'), 'utf-8')
    expect(config).toContain('@tailwindcss/vite')
    expect(config).toContain('tailwindcss()')
  })

  it('package.json has required dependencies', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(clientRoot, 'package.json'), 'utf-8'),
    )
    expect(pkg.dependencies).toHaveProperty('react')
    expect(pkg.dependencies).toHaveProperty('react-dom')
    expect(pkg.dependencies).toHaveProperty('react-router-dom')
    expect(pkg.dependencies).toHaveProperty('zustand')
    expect(pkg.dependencies).toHaveProperty('vexflow')
  })

  it('package.json has dev, build, and preview scripts', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(clientRoot, 'package.json'), 'utf-8'),
    )
    expect(pkg.scripts.dev).toBe('vite')
    expect(pkg.scripts.build).toBe('vite build')
    expect(pkg.scripts.preview).toBe('vite preview')
  })
})
