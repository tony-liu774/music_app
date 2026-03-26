/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('PWA manifest.json', () => {
  const manifestPath = resolve(__dirname, '../../public/manifest.json')
  let manifest

  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch {
    manifest = null
  }

  it('exists and is valid JSON', () => {
    expect(manifest).not.toBeNull()
  })

  it('has required PWA fields', () => {
    expect(manifest.name).toBe('The Virtual Concertmaster')
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('uses Midnight Conservatory theme color', () => {
    expect(manifest.background_color).toBe('#0a0a12')
    expect(manifest.theme_color).toBe('#0a0a12')
  })

  it('has icons with required sizes', () => {
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('has at least one maskable icon', () => {
    const maskable = manifest.icons.filter((i) => i.purpose === 'maskable')
    expect(maskable.length).toBeGreaterThanOrEqual(1)
  })
})
