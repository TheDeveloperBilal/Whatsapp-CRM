import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Plus, Smartphone, QrCode, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePortal } from '@/lib/store'
import type { WaSession } from '@/types/portal'

const statusVariant = (s: WaSession['status']) =>
  s === 'connected' ? 'default' : s === 'disconnected' ? 'destructive' : 'secondary'

export default function Sessions() {
  const { sessions, createSession, deleteSession, startSession, gatewayKind, profile } = usePortal()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [engine, setEngine] = useState('baileys')
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)

  const active = sessions.find((s) => s.id === connectingId)
  const live = profile.kind === 'portal'

  // render QR whenever the backend pushes a new qrCode for the connecting session
  useEffect(() => {
    if (active?.status === 'qr' && active.qrCode) {
      QRCode.toDataURL(active.qrCode, { width: 260, margin: 1 }).then(setQrImage).catch(() => {})
    } else {
      setQrImage(null)
    }
    if (active?.status === 'connected') setConnectingId(null)
  }, [active?.status, active?.qrCode])

  const connect = async (s: WaSession) => {
    setConnectingId(s.id)
    try {
      await startSession(s.id)
    } catch (e) {
      console.error(e)
      setConnectingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WhatsApp Sessions</h2>
          <p className="text-muted-foreground">
            Each session is one linked WhatsApp number. Connect and scan the QR code to go live.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 size-4" /> New session</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create session</DialogTitle>
              <DialogDescription>
                {live
                  ? 'Creates a WhatsApp session — connect it and scan the QR code with your phone.'
                  : 'Pick an engine, then scan the QR to link the number.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Session name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. support-main" />
              </div>
              {!live && (
                <div className="space-y-1.5">
                  <Label>Engine</Label>
                  <Select value={engine} onValueChange={setEngine}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp-web.js">WhatsApp Web</SelectItem>
                      <SelectItem value="baileys">WhatsApp Web (Baileys)</SelectItem>
                      <SelectItem value="cloud-api">Meta Cloud API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                disabled={!name.trim()}
                onClick={async () => {
                  const s = await createSession(name.trim(), engine)
                  setOpen(false)
                  setName('')
                  if (live) connect(s)
                }}
              >
                Create & connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="size-4" /> {s.name}
                </CardTitle>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </div>
              <CardDescription>{s.phone ?? 'no number linked'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Engine</span>
                <span className="font-mono text-xs">{s.engine}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Messages today</span>
                <span>{s.messagesToday}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={s.status === 'connected' ? 'outline' : 'default'}
                  className="flex-1"
                  onClick={() => connect(s)}
                  disabled={s.status === 'connecting'}
                >
                  {s.status === 'connected' ? (
                    <><RefreshCw className="mr-1 size-4" /> Reconnect</>
                  ) : (
                    <><QrCode className="mr-1 size-4" /> Connect & show QR</>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteSession(s.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No sessions yet — create one and scan the QR with WhatsApp → Linked devices.
          </p>
        )}
      </div>

      <Dialog open={!!active && (active.status === 'qr' || active.status === 'connecting')} onOpenChange={(o) => !o && setConnectingId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Scan to link “{active?.name}”</DialogTitle>
            <DialogDescription>
              WhatsApp → Settings → Linked devices → Link a device. The QR refreshes automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            {qrImage ? (
              <img src={qrImage} alt="WhatsApp QR" className="rounded-md border" width={260} height={260} />
            ) : (
              <div className="flex h-[260px] w-[260px] items-center justify-center rounded-md border text-sm text-muted-foreground">
                Requesting QR from WhatsApp…
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

