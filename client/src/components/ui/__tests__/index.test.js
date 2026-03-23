import { describe, it, expect } from 'vitest'
import { Button, Modal, Card, Toast, ToastProvider, useToast, Input, Select } from '../index'

describe('UI barrel export', () => {
  it('exports Button', () => {
    expect(Button).toBeDefined()
  })

  it('exports Modal', () => {
    expect(Modal).toBeDefined()
  })

  it('exports Card', () => {
    expect(Card).toBeDefined()
  })

  it('exports Toast', () => {
    expect(Toast).toBeDefined()
  })

  it('exports ToastProvider', () => {
    expect(ToastProvider).toBeDefined()
  })

  it('exports useToast', () => {
    expect(useToast).toBeDefined()
  })

  it('exports Input', () => {
    expect(Input).toBeDefined()
  })

  it('exports Select', () => {
    expect(Select).toBeDefined()
  })
})
