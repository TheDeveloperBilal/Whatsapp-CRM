import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MessageSquare, Users, Zap, Timer, Smartphone, Bot } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'

const EMPTY_VOLUME = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() - (6 - i) * 86_400_000)
  return { day: d.toLocaleDateString('en', { weekday: 'short' }), bot: 0, human: 0 }
})

export default function Overview() {
  const { stats, sessions, conversations, contacts, tenant } = usePortal()
  const volume = stats?.volume7d?.length ? stats.volume7d : EMPTY_VOLUME

  const cards = [
    { label: 'Open conversations', value: stats?.openConversations ?? conversations.filter((c) => c.status === 'open').length, icon: MessageSquare },
    { label: 'Messages today', value: stats?.messagesToday ?? 0, icon: Zap },
    { label: 'Response rate', value: `${stats?.responseRatePct ?? 0}%`, icon: Users },
    { label: 'Avg first response', value: `${stats?.avgFirstResponseMin ?? 0} min`, icon: Timer },
    { label: 'Sessions online', value: `${stats?.activeSessions ?? sessions.filter((s) => s.status === 'connected').length}/${sessions.length}`, icon: Smartphone },
    { label: 'Handled by AI bot', value: `${stats?.botHandledPct ?? 0}%`, icon: Bot },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{tenant.name} — Overview</h2>
        <p className="text-muted-foreground">
          Multi-tenant WhatsApp support workspace. {contacts.length} contacts under management.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Message volume (7 days)</CardTitle>
            <CardDescription>AI-bot handled vs human-agent messages</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volume}>
                <defs>
                  <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="bot" stroke="#059669" fill="url(#gBot)" name="AI bot" />
                <Area type="monotone" dataKey="human" stroke="#a1a1aa" fill="transparent" name="Human" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel health</CardTitle>
            <CardDescription>Connected WhatsApp sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.phone ?? 'not linked'} · {s.engine}</div>
                </div>
                <Badge variant={s.status === 'connected' ? 'default' : s.status === 'disconnected' ? 'destructive' : 'secondary'}>
                  {s.status}
                </Badge>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No sessions yet — link a WhatsApp number on the Sessions page.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
