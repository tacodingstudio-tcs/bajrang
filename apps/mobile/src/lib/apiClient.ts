// apps/mobile/src/lib/apiClient.ts
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000/api'
  : 'https://api.yourbillingapp.com/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
})

const STORAGE_KEY = 'billing-mobile-auth'

apiClient.interceptors.request.use(async (config) => {
  const authJson = await AsyncStorage.getItem(STORAGE_KEY)
  const token = authJson ? JSON.parse(authJson)?.accessToken : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// =============================================================================
// Silent refresh on 401
//
// A cashier should NEVER see a "session expired, please log in" screen
// mid-shift just because their 15-minute access token expired while they
// were billing a customer. This interceptor catches a 401, exchanges the
// stored refresh token for a new access token transparently, retries the
// ORIGINAL failed request with the new token, and the caller never knows
// anything happened.
//
// QUEUEING: if 5 API calls all fail with 401 within the same few hundred
// milliseconds (e.g. the sync engine firing several requests in parallel
// right as the token expired), we do NOT want to fire 5 separate refresh
// requests — only the FIRST 401 triggers a refresh; everyone else queues
// behind it and retries once the in-flight refresh resolves.
// =============================================================================

let isRefreshing = false
let refreshSubscribers: Array<(newToken: string) => void> = []

function subscribeToRefresh(callback: (newToken: string) => void) {
  refreshSubscribers.push(callback)
}

function notifyRefreshSubscribers(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

async function performRefresh(): Promise<string | null> {
  const authJson = await AsyncStorage.getItem(STORAGE_KEY)
  if (!authJson) return null

  const current = JSON.parse(authJson)
  if (!current.refreshToken) return null

  try {
    // Use a plain axios call here, NOT apiClient — calling apiClient would
    // re-enter this same interceptor chain if the refresh endpoint itself
    // ever returned a 401, causing infinite recursion.
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: current.refreshToken,
    })

    const { accessToken, refreshToken, accessTokenExpiresIn } = response.data

    const updated = {
      ...current,
      accessToken, refreshToken,
      accessTokenExpiresAt: Date.now() + accessTokenExpiresIn * 1000,
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    return accessToken
  } catch {
    // Refresh token itself is invalid/expired/revoked — there is no
    // recovery from this short of a full re-login. Clear stored auth so
    // the app's auth-gate (App.tsx) naturally falls back to the login screen.
    await AsyncStorage.removeItem(STORAGE_KEY)
    return null
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config

    // Only attempt refresh-and-retry for 401s, and only ONCE per request
    // (the _retry flag prevents an infinite loop if the retried request
    // somehow also comes back 401 — e.g. a permanently revoked refresh token).
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (isRefreshing) {
        // A refresh is already in flight from another request — queue
        // this request's retry to fire once that refresh resolves, rather
        // than triggering a second concurrent refresh call.
        return new Promise((resolve) => {
          subscribeToRefresh((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      isRefreshing = true
      const newToken = await performRefresh()
      isRefreshing = false

      if (newToken) {
        notifyRefreshSubscribers(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      }

      // Refresh failed — genuinely need to log in again. Queued requests
      // are notified with an empty token; their retries will naturally
      // fail with 401 again and propagate up to wherever the app handles
      // "redirect to login" (see App.tsx's auth-gate on accessToken).
      notifyRefreshSubscribers('')
    }

    return Promise.reject(error)
  }
)
