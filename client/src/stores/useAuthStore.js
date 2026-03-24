import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export const useAuthStore = create(
  devtools(
    (set) => ({
      user: null,
      session: null,
      loading: true,
      subscriptionStatus: 'free',

      setUser: (user) => set({ user }, false, 'setUser'),
      setSession: (session) => set({ session }, false, 'setSession'),
      setLoading: (loading) => set({ loading }, false, 'setLoading'),
      setSubscriptionStatus: (status) =>
        set({ subscriptionStatus: status }, false, 'setSubscriptionStatus'),

      setAuth: (user, session) =>
        set({ user, session, loading: false }, false, 'setAuth'),
      clearAuth: () =>
        set(
          {
            user: null,
            session: null,
            loading: false,
            subscriptionStatus: 'free',
          },
          false,
          'clearAuth',
        ),
    }),
    { name: 'AuthStore' },
  ),
)
