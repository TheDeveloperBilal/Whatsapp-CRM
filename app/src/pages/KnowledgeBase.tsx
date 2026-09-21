import { useState } from 'react'
import { BookOpen, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'

type ArticleLocal = { title: string; category: string; content: string }
const blank = (): ArticleLocal => ({ title: '', category: '', content: '' })
const articleBody = (a: { body?: string; content?: string }) => a.body || a.content || ''

export default function KnowledgeBase() {
  const { knowledgeBase, saveKbArticle, updateKbArticle, deleteKbArticle } = usePortal()

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<ArticleLocal>(blank())
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ArticleLocal>(blank())
  const [expanded, setExpanded] = useState<string | null>(null)

  const submitNew = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      await saveKbArticle({ title: form.title, category: form.category || 'General', body: form.content })
      setForm(blank())
      setShowNew(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (a: { id: string; title: string; category: string; body?: string; content?: string }) => {
    setEditId(a.id)
    setEditForm({ title: a.title, category: a.category, content: articleBody(a) })
    setExpanded(null)
  }

  const submitEdit = async () => {
    if (!editId) return
    setSaving(true)
    try {
      await updateKbArticle(editId, { title: editForm.title, category: editForm.category, body: editForm.content })
      setEditId(null)
    } finally {
      setSaving(false)
    }
  }

  const categories = [...new Set(knowledgeBase.map((a) => a.category))].sort()

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6" /> Knowledge Base
          </h2>
          <p className="text-muted-foreground mt-1">
            Articles injected into the AI's context — the bot uses these to answer customer questions
            accurately without hallucinating.
          </p>
        </div>
        <Button onClick={() => { setForm(blank()); setShowNew(true) }} className="shrink-0">
          <Plus className="size-4 mr-1" /> New Article
        </Button>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h3>
          <div className="grid gap-2">
            {knowledgeBase.filter((a) => a.category === cat).map((a) =>
              editId === a.id ? (
                <Card key={a.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Title</Label>
                        <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Content</Label>
                      <textarea
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-32"
                        value={editForm.content}
                        onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
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
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <button
                          className="font-medium hover:underline text-left"
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        >
                          {a.title}
                        </button>
                        {expanded === a.id ? (
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{articleBody(a)}</p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{articleBody(a)}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{a.category}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(a)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteKbArticle(a.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        </div>
      ))}

      {knowledgeBase.length === 0 && !showNew && (
        <p className="text-sm text-muted-foreground">
          No articles yet — click <strong>New Article</strong> to add one. The AI will use these
          to answer questions like return policies, shipping times, and payment methods.
        </p>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Knowledge Base Article</h3>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Return Policy"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  placeholder="e.g. Policies"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Content</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none min-h-36"
                placeholder="Write the article content here. The AI will use this verbatim to answer customer questions."
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={submitNew} disabled={saving || !form.title.trim() || !form.content.trim()}>
                {saving ? 'Saving…' : 'Save Article'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

