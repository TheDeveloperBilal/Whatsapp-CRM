import { useState } from 'react'
import { Bot, Plus, Trash2, PencilLine, Sparkles } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { usePortal } from '@/lib/store'
import type { BotRule } from '@/types/portal'

const emptyRule = (tenantId: string): BotRule => ({
  id: `b${Math.random().toString(36).slice(2, 8)}`,
  tenantId,
  name: '',
  enabled: true,
  matchType: 'keyword',
  pattern: '',
  response: '',
  sessionIds: [],
})

export default function Bots() {
  const { tenant, botConfig, updateBotConfig, botRules, toggleBotRule, saveBotRule, deleteBotRule, sessions } =
    usePortal()
  const [editing, setEditing] = useState<BotRule | null>(null)

  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name ?? id

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Auto-Responder</h2>
        <p className="text-muted-foreground">
          Keyword rules plus a generative AI layer. In production the bot runtime lives in the
          portal backend and can drive the gateway's MCP tools or a Dify/OpenAI flow.
        </p>
      </div>

      {/* AI layer config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" /> Generative AI layer
              </CardTitle>
              <CardDescription>
                Handles anything the keyword rules don't catch, using this persona.
              </CardDescription>
            </div>
            <Switch
              checked={botConfig.aiEnabled}
              onCheckedChange={(v) => updateBotConfig({ aiEnabled: v })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Persona & guardrails</Label>
            <Textarea
              value={botConfig.persona}
              onChange={(e) => updateBotConfig({ persona: e.target.value })}
              className="min-h-28"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>When the AI is unsure</Label>
              <Select
                value={botConfig.fallback}
                onValueChange={(v) => updateBotConfig({ fallback: v as 'human' | 'message' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="human">Hand off to human agent</SelectItem>
                  <SelectItem value="message">Send fallback message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Model route</Label>
              <Input
                value={botConfig.model}
                onChange={(e) => updateBotConfig({ model: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch
                id="hours"
                checked={botConfig.businessHoursOnly}
                onCheckedChange={(v) => updateBotConfig({ businessHoursOnly: v })}
              />
              <Label htmlFor="hours">Business hours only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* rules */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="size-5" /> Keyword & intent rules
        </h3>
        <Button onClick={() => setEditing(emptyRule(tenant.id))}>
          <Plus className="mr-1 size-4" /> New rule
        </Button>
      </div>

      <div className="grid gap-3">
        {botRules.map((r) => (
          <Card key={r.id} className={!r.enabled ? 'opacity-60' : undefined}>
            <CardContent className="flex items-start gap-4 p-4">
              <Switch checked={r.enabled} onCheckedChange={() => toggleBotRule(r.id)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="secondary">{r.matchType}</Badge>
                  {r.sessionIds.length > 0 ? (
                    r.sessionIds.map((id) => <Badge key={id} variant="outline">{sessionName(id)}</Badge>)
                  ) : (
                    <Badge variant="outline">all sessions</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{r.pattern}</span> → {r.response}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                <PencilLine className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteBotRule(r.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {botRules.length === 0 && (
          <p className="text-sm text-muted-foreground">No rules yet for this tenant.</p>
        )}
      </div>

      {/* editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{botRules.some((r) => r.id === editing.id) ? 'Edit rule' : 'New rule'}</DialogTitle>
                <DialogDescription>Match inbound messages and define the automated response.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Rule name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Order status lookup"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Match type</Label>
                    <Select
                      value={editing.matchType}
                      onValueChange={(v) => setEditing({ ...editing, matchType: v as BotRule['matchType'] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Keyword(s)</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                        <SelectItem value="intent">AI intent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pattern</Label>
                    <Input
                      value={editing.pattern}
                      onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                      placeholder="comma-separated keywords"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Response / action</Label>
                  <Textarea
                    value={editing.response}
                    onChange={(e) => setEditing({ ...editing, response: e.target.value })}
                    placeholder="What the bot should reply or do…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (editing.name.trim()) saveBotRule(editing)
                    setEditing(null)
                  }}
                >
                  Save rule
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

