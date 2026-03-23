import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentView: 'home',
      modalOpen: false,
      modalContent: null,
      toasts: [],
      sidebarOpen: true,
      theme: 'midnight',
      navVisible: true,
    })
  })

  it('has correct initial state', () => {
    const state = useUIStore.getState()
    expect(state.currentView).toBe('home')
    expect(state.modalOpen).toBe(false)
    expect(state.modalContent).toBeNull()
    expect(state.toasts).toEqual([])
    expect(state.sidebarOpen).toBe(true)
    expect(state.theme).toBe('midnight')
    expect(state.navVisible).toBe(true)
  })

  it('sets current view', () => {
    useUIStore.getState().setCurrentView('practice')
    expect(useUIStore.getState().currentView).toBe('practice')
  })

  it('opens and closes modal', () => {
    useUIStore.getState().openModal('settings')
    expect(useUIStore.getState().modalOpen).toBe(true)
    expect(useUIStore.getState().modalContent).toBe('settings')

    useUIStore.getState().closeModal()
    expect(useUIStore.getState().modalOpen).toBe(false)
    expect(useUIStore.getState().modalContent).toBeNull()
  })

  it('adds and removes toasts', () => {
    useUIStore.getState().addToast({ message: 'Hello', type: 'info' })
    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Hello')
    expect(toasts[0].type).toBe('info')
    expect(toasts[0].id).toBeDefined()

    useUIStore.getState().removeToast(toasts[0].id)
    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('toggles sidebar', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('sets sidebar open state directly', () => {
    useUIStore.getState().setSidebarOpen(false)
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it('sets theme', () => {
    useUIStore.getState().setTheme('light')
    expect(useUIStore.getState().theme).toBe('light')
  })

  it('sets nav visibility for ghost mode', () => {
    useUIStore.getState().setNavVisible(false)
    expect(useUIStore.getState().navVisible).toBe(false)
  })
})
