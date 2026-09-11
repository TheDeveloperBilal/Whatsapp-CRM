// ─── Portal store root ───────────────────────────────────────────────────────
// Picks the provider by the active gateway profile:
//   kind 'portal' → LiveProvider (local backend: Baileys + AI bot + WS)
//   anything else → MockProvider (demo data; also hosts openwa/evolution direct)
// Pages consume everything through usePortal() and never know the difference.

import { useCallback, useState, type ReactNode } from 'react'
import { loadProfile, saveProfile } from '@/lib/gateway'
import type { GatewayProfile } from '@/types/portal'
import { LiveProvider } from './providers/portal'
import { MockProvider } from './providers/mock'

export { usePortal } from './portal-context'

export function PortalProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<GatewayProfile>(loadProfile)
  const updateProfile = useCallback((p: GatewayProfile) => {
    saveProfile(p)
    setProfile(p)
  }, [])

  if (profile.kind === 'portal') {
    return (
      <LiveProvider profile={profile} updateProfile={updateProfile}>
        {children}
      </LiveProvider>
    )
  }
  return (
    <MockProvider profile={profile} updateProfile={updateProfile}>
      {children}
    </MockProvider>
  )
}
