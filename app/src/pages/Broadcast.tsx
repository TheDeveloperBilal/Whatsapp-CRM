import { useState, useMemo } from 'react'
import { Megaphone, Send, Search, CheckSquare, Square } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'
import { toast } from 'sonner'

export default function Broadcast() {
  const { contacts, sendBroadcast } = usePortal()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.optedIn !== false &&
          (c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone.includes(search)),
      ),
    [contacts, search],
  )

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.id)))
  const clearAll = () => setSelected(new Set())

  const send = async () => {
    if (!message.trim() || selected.size === 0) return
    setSending(true)
    setResult(null)
    try {
      const r = await sendBroadcast(message, [...selected])
      setResult(r)
      if (r.failed === 0) {
        toast.success(`Broadcast sent to ${r.sent} contacts`)
        setMessage('')
        setSelected(new Set())
      } else {
        toast.warning(`${r.sent} sent, ${r.failed} failed`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Send failed'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="size-6" /> Broadcast Message
        </h2>
        <p className="text-muted-foreground mt-1">
          Send a one-to-many message to selected contacts via the connected WhatsApp session.
          A small delay is inserted between sends to avoid bans.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contact picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Recipients ({selected.size} selected)</Label>
            <div className="flex gap-2 text-xs">
              <button className="text-primary hover:underline" onClick={selectAll}>Select all</button>
              <span className="text-muted-foreground">·</span>
              <button className="text-muted-foreground hover:underline" onClick={clearAll}>Clear</button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="border rounded-lg overflow-hidden divide-y max-h-96 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No contacts found</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left"
                onClick={() => toggle(c.id)}
              >
                {selected.has(c.id) ? (
                  <CheckSquare className="size-4 text-primary shrink-0" />
                ) : (
                  <Square className="size-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </div>
                {c.tags.length > 0 && (
                  <Badge variant="secondary" className="shrink-0 text-xs">{c.tags.length} tags</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Compose */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Message</Label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-40"
              placeholder="Type your broadcast message here…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{message.length} characters</p>
          </div>

          {result && (
            <Card className={result.failed > 0 ? 'border-amber-500' : 'border-emerald-500'}>
              <CardContent className="p-3 text-sm">
                <span className="text-emerald-600 font-medium">{result.sent} sent</span>
                {result.failed > 0 && (
                  <span className="text-amber-600 font-medium ml-2">{result.failed} failed</span>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            disabled={sending || selected.size === 0 || !message.trim()}
            onClick={send}
          >
            {sending ? (
              'Sending…'
            ) : (
              <>
                <Send className="size-4 mr-2" />
                Send to {selected.size} contact{selected.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Only contacts with opt-in status are shown. Messages are sent via your first connected
            session with an 800 ms delay between each send.
          </p>
        </div>
      </div>
    </div>
  )
}
