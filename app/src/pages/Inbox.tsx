import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bot, CheckCheck, Check, Clock, Send, UserRound, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePortal } from '@/lib/store'
import type { Conversation, Message } from '@/types/portal'

function Tick({ status }: { status: Message['status'] }) {
  if (status === 'read') return <CheckCheck className="size-3.5 text-sky-500" />
  if (status === 'delivered') return <CheckCheck className="size-3.5 text-muted-foreground" />
  if (status === 'failed') return <Clock className="size-3.5 text-destructive" />
  return <Check className="size-3.5 text-muted-foreground" />
}

export default function Inbox() {
  const {
    conversations,
    contacts,
    tenant,
    tags,
    messagesFor,
    ensureMessages,
    sendMessage,
    toggleConversationBot,
    assignConversation,
    setConversationStatus,
    markRead,
    saveContactNote,
  } = usePortal()
  const [activeId, setActiveId] = useState<string | undefined>(conversations[0]?.id)
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = conversations.find((c) => c.id === activeId)
  const contact = contacts.find((c) => c.id === active?.contactId)
  const msgs = useMemo(() => (active ? messagesFor(active.id) : []), [active, messagesFor])

  useEffect(() => {
    if (active) {
      ensureMessages(active.id)
      markRead(active.id)
    }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  const pendingCount = conversations.filter((c) => c.status === 'pending').length
  const filtered = conversations.filter((c) => (filter === 'all' ? true : c.status === filter))

  const contactOf = (c: Conversation) => contacts.find((x) => x.id === c.contactId)

  const send = async () => {
    if (!draft.trim() || !active) return
    const text = draft.trim()
    setDraft('')
    await sendMessage(active.id, text)
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[320px_1fr_300px]">
      {/* ── conversation list ─────────────────────────────── */}
      <div className="border-r flex flex-col min-h-0">
        <div className="p-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 relative">
                Pending
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved" className="flex-1">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="flex-1">
          {filtered.map((c) => {
            const ct = contactOf(c)
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b hover:bg-accent/50 transition-colors',
                  c.id === activeId && 'bg-accent',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="size-9">
                      <AvatarFallback style={{ backgroundColor: `hsl(${ct?.avatarHue ?? 0} 60% 85%)` }}>
                        {ct?.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {c.status === 'pending' && (
                      <span className="absolute -top-0.5 -right-0.5 flex size-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-3 bg-red-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium truncate', c.status === 'pending' && 'text-red-500')}>{ct?.name}</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: false })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.status === 'pending'
                        ? <AlertCircle className="size-3 text-red-500 shrink-0" />
                        : c.botEnabled && <Bot className="size-3 text-primary shrink-0" />}
                      <p className={cn('text-xs truncate', c.status === 'pending' ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                        {c.status === 'pending' ? 'Needs human agent' : c.lastMessage?.body}
                      </p>
                      {c.unread > 0 && (
                        <Badge className="ml-auto shrink-0 h-5 px-1.5">{c.unread}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No conversations in this view.</p>
          )}
        </ScrollArea>
      </div>

      {/* ── thread ────────────────────────────────────────── */}
      <div className="flex flex-col min-h-0">
        {active && contact ? (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <Avatar className="size-8">
                <AvatarFallback style={{ backgroundColor: `hsl(${contact.avatarHue} 60% 85%)` }}>
                  {contact.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium leading-tight">{contact.name}</div>
                <div className="text-xs text-muted-foreground">{contact.phone}</div>
              </div>
              <Select
                value={active.status}
                onValueChange={(v) => setConversationStatus(active.id, v as Conversation['status'])}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {msgs.map((m) => (
                  <div key={m.id} className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2 max-w-[75%] text-sm shadow-sm',
                        m.fromMe
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 rounded-br-sm'
                          : 'bg-card border rounded-bl-sm',
                      )}
                    >
                      {m.type === 'image' ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ImageIcon className="size-4" /> {m.body}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        {m.byBot && (
                          <span className="inline-flex items-center gap-0.5 text-primary">
                            <Bot className="size-3" /> AI
                          </span>
                        )}
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.fromMe && <Tick status={m.status} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-3">
              <div className="flex items-end gap-2 max-w-2xl mx-auto">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={active.botEnabled ? 'AI auto-responder is ON for this chat — reply manually to take over…' : 'Type a reply…'}
                  className="min-h-11 max-h-32 resize-none"
                />
                <Button size="icon" onClick={send} disabled={!draft.trim()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>

      {/* ── contact / context panel ───────────────────────── */}
      <div className="hidden lg:flex border-l flex-col min-h-0">
        {active && contact ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              <div className="flex flex-col items-center text-center gap-2">
                <Avatar className="size-16">
                  <AvatarFallback
                    className="text-lg"
                    style={{ backgroundColor: `hsl(${contact.avatarHue} 60% 85%)` }}
                  >
                    {contact.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{contact.name}</div>
                  <div className="text-xs text-muted-foreground">{contact.phone}</div>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {contact.tags.map((tid) => {
                    const t = tags.find((x) => x.id === tid)
                    return t ? (
                      <Badge key={tid} variant="outline" style={{ borderColor: t.color, color: t.color }}>
                        {t.label}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="size-4 text-primary" /> AI auto-responder
                </div>
                <Switch checked={active.botEnabled} onCheckedChange={() => toggleConversationBot(active.id)} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserRound className="size-4" /> Assigned agent
                </div>
                <Select
                  value={active.assigneeId ?? 'unassigned'}
                  onValueChange={(v) => assignConversation(active.id, v === 'unassigned' ? undefined : v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {tenant.members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-medium">CRM notes</div>
                <Textarea
                  defaultValue={contact.notes}
                  placeholder="Private notes about this customer…"
                  className="min-h-24 text-sm"
                  onBlur={(e) => saveContactNote(contact.id, e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            No selection
          </div>
        )}
      </div>
    </div>
  )
}
