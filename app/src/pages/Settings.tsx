import { useState } from 'react'
import { Plug, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { usePortal } from '@/lib/store'
import { DEFAULT_BACKEND_URL } from '@/lib/backend'
import type { GatewayKind } from '@/types/portal'

const options: Array<{ value: GatewayKind; title: string; desc: string; defaultUrl: string }> = [
  {
    value: 'portal',
    title: 'Portal backend (recommended, live)',
    desc: 'The built-in local backend: Baileys WhatsApp engine + AI auto-responder + WebSocket events. Starts automatically with npm run dev.',
    defaultUrl: DEFAULT_BACKEND_URL || 'http://localhost:8787',
  },
  {
    value: 'mock',
    title: 'Demo mode (built-in mock)',
    desc: 'Fully working demo data with simulated inbound messages. No real WhatsApp needed.',
    defaultUrl: '',
  },
  {
    value: 'openwa',
    title: 'OpenWA (direct, partial)',
    desc: 'Experimental: talk straight to an external OpenWA gateway. Session list/connect only.',
    defaultUrl: 'http://localhost:2785',
  },
  {
    value: 'evolution',
    title: 'Evolution API (direct, partial)',
    desc: 'Experimental: talk straight to an external Evolution API. Instance list/connect only.',
    defaultUrl: 'http://localhost:8080',
  },
]

export default function Settings() {
  const { profile, updateProfile } = usePortal()
  const [kind, setKind] = useState<GatewayKind>(profile.kind)
  const [baseUrl, setBaseUrl] = useState(profile.baseUrl)
  const [apiKey, setApiKey] = useState(profile.apiKey)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Choose where the portal gets its WhatsApp data. The built-in backend covers the full CRM;
          direct gateway modes are integration seams for later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="size-5" /> Backend connection
          </CardTitle>
          <CardDescription>
            AI replies need an LLM key: set <code>AI_API_KEY</code> (and optionally{' '}
            <code>AI_BASE_URL</code> / <code>AI_MODEL</code>) in <code>app/.env</code> and restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup
            value={kind}
            onValueChange={(v) => {
              const k = v as GatewayKind
              setKind(k)
              setBaseUrl(options.find((o) => o.value === k)?.defaultUrl ?? '')
            }}
            className="space-y-3"
          >
            {options.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${kind === o.value ? 'border-primary' : ''}`}
              >
                <RadioGroupItem value={o.value} className="mt-1" />
                <span>
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-sm text-muted-foreground">{o.desc}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {kind !== 'mock' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:8787" />
              </div>
              {kind !== 'portal' && (
                <div className="space-y-1.5">
                  <Label>API key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={kind === 'openwa' ? 'X-API-Key' : 'apikey'}
                  />
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => {
              updateProfile({ kind, baseUrl, apiKey })
              toast.success('Backend profile saved', { description: `Mode: ${kind}` })
            }}
          >
            <Save className="mr-1 size-4" /> Save & reconnect
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
