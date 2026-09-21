import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search, UserCheck, UserX } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { usePortal } from '@/lib/store'
import type { Contact } from '@/types/portal'

export default function Contacts() {
  const { contacts, tags, saveContactNote } = usePortal()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.phone.includes(needle),
    )
  }, [contacts, q])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground">
            CRM records synced from WhatsApp conversations. {contacts.length} total.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Opt-in</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarFallback style={{ backgroundColor: `hsl(${c.avatarHue} 60% 85%)` }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((tid) => {
                      const t = tags.find((x) => x.id === tid)
                      return t ? (
                        <Badge key={tid} variant="outline" style={{ borderColor: t.color, color: t.color }}>
                          {t.label}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  {c.optedIn ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                      <UserCheck className="size-4" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                      <UserX className="size-4" /> No
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.lastMessageAt
                    ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.phone} · chat id <code>{selected.chatId}</code>
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tid) => {
                    const t = tags.find((x) => x.id === tid)
                    return t ? (
                      <Badge key={tid} variant="outline" style={{ borderColor: t.color, color: t.color }}>
                        {t.label}
                      </Badge>
                    ) : null
                  })}
                </div>
                <div>
                  <div className="mb-1.5 text-sm font-medium">Notes</div>
                  <Textarea
                    defaultValue={selected.notes}
                    className="min-h-32"
                    onBlur={(e) => saveContactNote(selected.id, e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Saved automatically on blur.</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

