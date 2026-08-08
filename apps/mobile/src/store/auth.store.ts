// apps/mobile/src/store/auth.store.ts
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface AuthState {
  accessToken:  string | null
  refreshToken: string | null
  accessTokenExpiresAt: number | null  // epoch ms — used to schedule silent refresh
  userId: string | null
  userName: string | null
  branchId: string | null
  branchName: string | null
  domainType: string | null
  isHydrated: boolean

  login: (data: {
    accessToken: string; refreshToken: string; accessTokenExpiresIn: number
    userId: string; userName: string; branchId: string; branchName: string; domainType: string
  }) => Promise<void>

  // Called by apiClient.ts after a successful silent refresh — updates
  // both tokens without touching the rest of the session (branch, user info).
  setTokens: (accessToken: string, refreshToken: string, accessTokenExpiresIn: number) => Promise<void>

  logout:  () => Promise<void>
  hydrate: () => Promise<void>
}

const STORAGE_KEY = 'billing-mobile-auth'

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null, refreshToken: null, accessTokenExpiresAt: null,
  userId: null, userName: null, branchId: null, branchName: null, domainType: null,
  isHydrated: false,

  login: async (data) => {
    const accessTokenExpiresAt = Date.now() + data.accessTokenExpiresIn * 1000
    const toStore = {
      accessToken: data.accessToken, refreshToken: data.refreshToken, accessTokenExpiresAt,
      userId: data.userId, userName: data.userName,
      branchId: data.branchId, branchName: data.branchName, domainType: data.domainType,
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    set(toStore)
  },

  setTokens: async (accessToken, refreshToken, accessTokenExpiresIn) => {
    const accessTokenExpiresAt = Date.now() + accessTokenExpiresIn * 1000
    const current = get()
    const toStore = { ...current, accessToken, refreshToken, accessTokenExpiresAt }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    set({ accessToken, refreshToken, accessTokenExpiresAt })
  },

  logout: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    set({
      accessToken: null, refreshToken: null, accessTokenExpiresAt: null,
      userId: null, userName: null, branchId: null, branchName: null, domainType: null,
    })
  },

  hydrate: async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY)
    if (json) {
      const data = JSON.parse(json)
      set({ ...data, isHydrated: true })
    } else {
      set({ isHydrated: true })
    }
  },
}))
