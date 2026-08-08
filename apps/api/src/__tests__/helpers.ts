import axios, { AxiosInstance } from 'axios'

export const BASE = 'http://localhost:3000'

export interface Session {
  api: AxiosInstance
  branchId: string
  userId: string
  token: string
}

// Login as the krishna_wholesale tenant (B2B domain) — has all features
export async function loginWholesale(): Promise<Session> {
  return login('9844002002', '8002')
}

// Login as the glamour_salon tenant (simple domain)
export async function loginSalon(): Promise<Session> {
  return login('9844001001', '8001')
}

// Login as the ramesh_kirana tenant (retail — simple domain with stock)
export async function loginKirana(): Promise<Session> {
  return login('9876543210', '1111')
}

// Login as the Hotel Surya Palace tenant
export async function loginHotel(): Promise<Session> {
  return login('9844009009', '8009')
}

// Login as the Shree Steel Traders tenant (iron & steel domain)
export async function loginIronSteel(): Promise<Session> {
  return login('9849001001', '9401')
}

export async function login(phone: string, pin: string): Promise<Session> {
  const res = await axios.post(`${BASE}/api/auth/login`, { tenantPhone: phone, phone, pin })
  const { accessToken, user, branch } = res.data
  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // attach 401 → throw helper
  api.interceptors.response.use(r => r, err => Promise.reject(err))
  return { api, branchId: branch.id, userId: user.id, token: accessToken }
}
