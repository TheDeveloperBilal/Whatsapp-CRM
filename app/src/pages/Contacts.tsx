import { useMemo, useState, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search, UserCheck, UserX, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePortal } from '@/lib/store'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { loadProfile } from '@/lib/gateway'
import type { Contact } from '@/types/portal'

const contactsClient = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

interface CsvRow { name: string; phone: string; notes: string }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
  const nameIdx = header.indexOf('name')
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'number' || h === 'mobile')
  const notesIdx = header.indexOf('notes')
  if (phoneIdx === -1) return []
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return {
      name: nameIdx >= 0 ? cols[nameIdx] ?? '' : '',
      phone: cols[phoneIdx] ?? '',
      notes: notesIdx >= 0 ? cols[notesIdx] ?? '' : '',
    }
  }).filter((r) => r.phone)
}

// A contact whose name is just a phone number (starts with '+') and has no real name
// is a WhatsApp LID contact — hide from the list by default.
function hasRealName(c: Contact) {
  return c.name && !c.name.startsWith('+') && c.name !== 'Unknown'
}

export default function Contacts() {
  const { contacts, tags, saveContactNote, tenant } = usePortal()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [showUnknown, setShowUnknown] = useState(false)
  // CSV import
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvDialog, setCsvDialog] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string)
      setCsvRows(rows)
      setCsvResult(null)
      setCsvDialog(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!tenant?.id || !csvRows.length) return
    setCsvImporting(true)
    try {
      const result = await contactsClient.importContacts(tenant.id, csvRows)
      setCsvResult(result)
      toast.success(`Imported ${result.created} contacts (${result.skipped} skipped)`)
      setCsvRows([])
    } catch {
      toast.error('Import failed')
    } finally {
      setCsvImporting(false)
    }
  }

  const identified = useMemo(() => showUnknown ? contacts : contacts.filter(hasRealName), [contacts, showUnknown])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return identified.filter(
      (c) => c.name.toLowerCase().includes(needle) || (c.phone || '').includes(needle),
    )
  }, [identified, q])

  const unknownCount = contacts.length - contacts.filter(hasRealName).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground">
            {contacts.filter(hasRealName).length} identified contacts
            {unknownCount > 0 && (
              <button
                onClick={() => setShowUnknown(v => !v)}
                className="ml-2 text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
              >
                {showUnknown ? `hide ${unknownCount} unidentified` : `+ ${unknownCount} unidentified`}
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4 mr-1.5" />
            Import CSV
          </Button>
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
                <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
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

      {/* CSV Import Dialog */}
      <Dialog open={csvDialog} onOpenChange={(o) => { if (!o) { setCsvDialog(false); setCsvRows([]); setCsvResult(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
          </DialogHeader>
          {csvResult ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
              <p className="font-semibold text-lg">{csvResult.created} contacts imported</p>
              <p className="text-sm text-muted-foreground">{csvResult.skipped} skipped (already exist or missing phone)</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  CSV must have a <code className="bg-muted px-1 rounded text-xs">phone</code> column. Optional: <code className="bg-muted px-1 rounded text-xs">name</code>, <code className="bg-muted px-1 rounded text-xs">notes</code>.
                </p>
                {csvRows.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-y-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvRows.slice(0, 50).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{r.name || '—'}</TableCell>
                              <TableCell className="text-sm">{r.phone}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{r.notes || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {csvRows.length > 50 && (
                      <p className="text-xs text-muted-foreground px-3 py-2">…and {csvRows.length - 50} more rows</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertCircle className="size-4 flex-shrink-0" />
                    No valid rows found. Ensure the CSV has a <code>phone</code> column.
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCsvDialog(false); setCsvRows([]) }}>Cancel</Button>
                <Button onClick={handleImport} disabled={!csvRows.length || csvImporting}>
                  {csvImporting ? 'Importing…' : `Import ${csvRows.length} Contacts`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.phone || 'No phone'} · chat id <code className="text-xs">{selected.chatId}</code>
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

