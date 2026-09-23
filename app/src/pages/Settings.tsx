import { useState } from 'react'
import { KeyRound, Building2, Clock, Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { usePortal } from '@/lib/store'
import { PortalClient, DEFAULT_BACKEND_URL } from '@/lib/backend'
import { loadProfile } from '@/lib/gateway'

const client = new PortalClient(loadProfile().baseUrl || DEFAULT_BACKEND_URL)

export default function Settings() {
  const { currentUser, tenant, botConfig, updateBotConfig, updateTenant } = usePortal()

  // ── Change password ──────────────────────────────────────────────────────────
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const savePassword = async () => {
    if (!oldPw || !newPw) return
    if (newPw !== confirmPw) { toast.error('New passwords do not match'); return }
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      await client.changePassword(oldPw, newPw)
      toast.success('Password changed successfully')
      setOldPw(''); setNewPw(''); setConfirmPw('')
    } catch {
      toast.error('Wrong current password')
    } finally {
      setPwSaving(false)
    }
  }

  // ── Business profile ─────────────────────────────────────────────────────────
  const [bizName, setBizName] = useState(tenant?.name ?? '')
  const [bizSaving, setBizSaving] = useState(false)
  const isOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'superadmin'

  const saveBizName = async () => {
    if (!bizName.trim() || !tenant?.id) return
    setBizSaving(true)
    try {
      await client.updateTenantProfile(tenant.id, { name: bizName.trim() })
      toast.success('Business name updated')
    } catch {
      toast.error('Failed to update business name')
    } finally {
      setBizSaving(false)
    }
  }

  // ── Business hours ───────────────────────────────────────────────────────────
  const hoursOnly = botConfig?.businessHoursOnly ?? false

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and workspace preferences.</p>
      </div>

      {/* ── Account ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Account
          </CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium text-foreground">{currentUser?.username}</span>
            {' '}· <span className="capitalize">{currentUser?.role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={oldPw}
                  onChange={e => setOldPw(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={savePassword}
            disabled={pwSaving || !oldPw || !newPw || !confirmPw}
          >
            {pwSaving
              ? <><Loader2 className="mr-1 size-3.5 animate-spin" /> Saving…</>
              : <><Check className="mr-1 size-3.5" /> Change password</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── Business Profile ── */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" /> Business Profile
            </CardTitle>
            <CardDescription>
              Your workspace name shown across the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Business name</Label>
                <Input
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                  placeholder="e.g. OviTech Global"
                />
              </div>
              <Button
                size="sm"
                onClick={saveBizName}
                disabled={bizSaving || !bizName.trim() || bizName.trim() === tenant?.name}
              >
                {bizSaving
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <><Check className="mr-1 size-3.5" /> Save</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Business Hours ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" /> Business Hours
          </CardTitle>
          <CardDescription>
            When this is on, the AI only replies between 8 am and 9 pm. Outside those hours
            customers get your fallback message instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Restrict AI to business hours</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hoursOnly ? 'Active — AI replies 8 am–9 pm only' : 'Off — AI replies 24/7'}
              </p>
            </div>
            <Switch
              checked={hoursOnly}
              onCheckedChange={v => {
                updateBotConfig({ businessHoursOnly: v })
                toast.success(v ? 'AI restricted to business hours' : 'AI set to reply 24/7')
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
