import { useState } from 'react'
import { MessageSquareDashed, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'

type CannedResponseLocal = { title: string; shortcut: string; body: string }

const blank = (): CannedResponseLocal => ({ title: '', shortcut: '', body: '' })

export default function CannedResponses() {
  const { cannedResponses, saveCannedResponse, updateCannedResponse, deleteCannedResponse } = usePortal()

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<CannedResponseLocal>(blank())
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CannedResponseLocal>(blank())

  const submitNew = async () => {
    if (!form.title.trim() || !form.shortcut.trim() || !form.body.trim()) return
    const shortcut = form.shortcut.startsWith('/') ? form.shortcut : `/${form.shortcut}`
    setSaving(true)
    try {
      await saveCannedResponse({ ...form, shortcut })
      setForm(blank())
      setShowNew(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cr: { id: string; title: string; shortcut: string; body: string }) => {
    setEditId(cr.id)
    setEditForm({ title: cr.title, shortcut: cr.shortcut, body: cr.body })
  }

  const submitEdit = async () => {
    if (!editId) return
    setSaving(true)
    try {
      await updateCannedResponse(editId, editForm)
      setEditId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareDashed className="size-6" /> Canned Responses
          </h2>
          <p className="text-muted-foreground mt-1">
            Shortcut templates agents can insert instantly — type the shortcut (e.g. <code>/hi</code>) in
            the Inbox compose box to expand.
          </p>
        </div>
        <Button onClick={() => { setForm(blank()); setShowNew(true) }} className="shrink-0">
          <Plus className="size-4 mr-1" /> New Response
        </Button>
      </div>

      <div className="grid gap-3">
        {cannedResponses.map((cr) =>
          editId === cr.id ? (
            <Card key={cr.id}>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Shortcut</Label>
                    <Input value={editForm.shortcut} onChange={(e) => setEditForm((f) => ({ ...f, shortcut: e.target.value }))} placeholder="/keyword" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Message body</Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-20"
                    value={editForm.body}
                    onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                  <Button size="sm" onClick={submitEdit} disabled={saving}>
                    <Check className="size-3.5 mr-1" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={cr.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cr.title}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{cr.shortcut}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{cr.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(cr)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteCannedResponse(cr.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ),
        )}
        {cannedResponses.length === 0 && !showNew && (
          <p className="text-sm text-muted-foreground">
            No canned responses yet — click <strong>New Response</strong> to add one.
          </p>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Canned Response</h3>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Greeting"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Shortcut</Label>
                <Input
                  placeholder="/hi"
                  value={form.shortcut}
                  onChange={(e) => setForm((f) => ({ ...f, shortcut: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Message body</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-28"
                placeholder="Hello! How can I help you today?"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={submitNew} disabled={saving || !form.title.trim() || !form.shortcut.trim() || !form.body.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

