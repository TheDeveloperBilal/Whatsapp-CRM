import { createContext, useContext } from 'react'
import type { PortalState } from './portal-state'

export const PortalCtx = createContext<PortalState | null>(null)

export function usePortal(): PortalState {
  const v = useContext(PortalCtx)
  if (!v) throw new Error('usePortal outside PortalProvider')
  return v
}
