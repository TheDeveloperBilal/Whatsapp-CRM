import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { PortalProvider } from '@/lib/store'
import AppLayout from '@/components/layout/AppLayout'
import Overview from '@/pages/Overview'
import Inbox from '@/pages/Inbox'
import Contacts from '@/pages/Contacts'
import Bots from '@/pages/Bots'
import Sessions from '@/pages/Sessions'
import Automation from '@/pages/Automation'
import Products from '@/pages/Products'
import CannedResponses from '@/pages/CannedResponses'
import Broadcast from '@/pages/Broadcast'
import Campaigns from '@/pages/Campaigns'
import KnowledgeBase from '@/pages/KnowledgeBase'
import Tenants from '@/pages/Tenants'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import { isLoggedIn } from '@/lib/auth'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)

  // Listen for 401 events from PortalClient
  useEffect(() => {
    const onUnauth = () => setLoggedIn(false)
    window.addEventListener('portal:unauthorized', onUnauth)
    return () => window.removeEventListener('portal:unauthorized', onUnauth)
  }, [])

  if (!loggedIn) {
    return (
      <>
        <Login onLogin={() => {
          window.history.replaceState({}, '', '/')
          setLoggedIn(true)
        }} />
        <Toaster position="bottom-right" />
      </>
    )
  }

  return (
    <PortalProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/products" element={<Products />} />
          <Route path="/canned-responses" element={<CannedResponses />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </PortalProvider>
  )
}
