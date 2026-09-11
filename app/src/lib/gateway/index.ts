// Gateway factory — pick the adapter from the tenant's connection profile.
// Settings page persists the profile to localStorage; swap 'mock' for
// 'openwa'/'evolution' once a real backend + portal API are in place.

import type { WhatsAppGateway } from './types'
import type { GatewayProfile } from '@/types/portal'
import { MockAdapter } from './mock'
import { OpenWAAdapter } from './openwa'
import { EvolutionAdapter } from './evolution'
import { DEFAULT_BACKEND_URL } from '@/lib/backend'

const STORAGE_KEY = 'waportal.gateway'

export function loadProfile(): GatewayProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as GatewayProfile
  } catch {
    /* fall through */
  }
  return { kind: 'portal', baseUrl: DEFAULT_BACKEND_URL, apiKey: '' }
}

export function saveProfile(p: GatewayProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

let cached: { key: string; gw: WhatsAppGateway } | null = null

export function getGateway(profile: GatewayProfile = loadProfile()): WhatsAppGateway {
  const key = JSON.stringify(profile)
  if (cached?.key === key) return cached.gw
  let gw: WhatsAppGateway
  switch (profile.kind) {
    case 'openwa':
      gw = new OpenWAAdapter(profile.baseUrl, profile.apiKey)
      break
    case 'evolution':
      gw = new EvolutionAdapter(profile.baseUrl, profile.apiKey)
      break
    default:
      gw = new MockAdapter()
  }
  cached = { key, gw }
  return gw
}
