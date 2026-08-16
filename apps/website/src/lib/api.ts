import axios from 'axios'

export const api = axios.create({ baseURL: '/api/public' })

export interface HotelProfile {
  name: string
  gstin: string | null
  address: unknown
  stateCode: string | null
  domainConfig: { has_folio?: boolean; has_rooms?: boolean; checkout_time?: string }
  tenantName: string
}

export interface RoomTypeSummary {
  roomType: string
  fromRate: number
  maxOccupancy: number
  hasAc: boolean
  hasTv: boolean
  hasWifi: boolean
  hasGeyser: boolean
  viewTypes: string[] | null
  imageUrl: string | null
  images: string[] | null
  description: string | null
  roomCount: number
}

export interface InquiryPayload {
  guestName: string
  guestPhone: string
  guestEmail?: string
  roomType: string
  checkIn: string
  checkOut: string
  adults: number
  children?: number
  notes?: string
}

export interface InquiryResult {
  folioNo: string
  roomType: string
  roomNo: string
  nights: number
  totalAmount: number
  message: string
}
