import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export const useUIStore = create(
  devtools(
    (set) => ({
      // Current view / route
      currentView: 'home',
      setCurrentView: (view) =>
        set({ currentView: view }, false, 'setCurrentView'),

      // Modal state
      modalOpen: false,
      modalContent: null,
      openModal: (content) =>
        set({ modalOpen: true, modalContent: content }, false, 'openModal'),
      closeModal: () =>
        set({ modalOpen: false, modalContent: null }, false, 'closeModal'),

      // Toast queue
      toasts: [],
      addToast: (toast) =>
        set(
          (state) => ({
            toasts: [...state.toasts, { id: Date.now(), ...toast }],
          }),
          false,
          'addToast',
        ),
      removeToast: (id) =>
        set(
          (state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }),
          false,
          'removeToast',
        ),

      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () =>
        set(
          (state) => ({ sidebarOpen: !state.sidebarOpen }),
          false,
          'toggleSidebar',
        ),
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, 'setSidebarOpen'),

      // Theme preferences
      theme: 'midnight',
      setTheme: (theme) => set({ theme }, false, 'setTheme'),

      // Nav visibility (ghost mode fade)
      navVisible: true,
      setNavVisible: (visible) =>
        set({ navVisible: visible }, false, 'setNavVisible'),

      // Ghost mode — activated during practice
      ghostMode: false,
      enterGhostMode: () =>
        set({ ghostMode: true, navVisible: false }, false, 'enterGhostMode'),
      exitGhostMode: () =>
        set({ ghostMode: false, navVisible: true }, false, 'exitGhostMode'),
    }),
    { name: 'UIStore' },
  ),
)
