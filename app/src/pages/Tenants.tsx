import { useState, useEffect } from 'react'
import {
  Building2, Crown, Shield, Headset, Eye,
  Plus, Pencil, Trash2, UserPlus, Loader2,
  CheckCircle2, XCircle, Users, AlertTriangle,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { usePortal } from '@/lib/store'
import type { TenantUser } from '@/lib/backend'
import { BUSINESS_TYPE_META } from '@/types/portal'
// local type aliases to avoid verbatimModuleSyntax issues
type LocalTenantRole = 'owner' | 'admin' | 'agent' | 'viewer'
type LocalBusinessType = 'service' | 'digital' | 'physical'

const BT_OPTIONS: { value: LocalBusinessType; label: string; emoji: string; desc: string }[] = [
  { value: 'service',  emoji: '🛠️', label: 'Service Business',  desc: 'Logo design, web dev, writing, consulting...' },
  { value: 'digital',  emoji: '💻', label: 'Digital Products',  desc: 'E-books, games, software, courses...' },
  { value: 'physical', emoji: '📦', label: 'Physical Products', desc: 'Clothing, electronics, food, goods...' },
]

const roleIcon: Record<LocalTenantRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  agent: Headset,
  viewer: Eye,
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  business: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

interface CreateTenantForm {
  name: string
  slug: string
  plan: string
  businessType: string
  adminUsername: string
  adminPassword: string
}

const emptyCreate: CreateTenantForm = {
  name: '', slug: '', plan: 'free', businessType: 'service', adminUsername: '', adminPassword: '',
}

export default function Tenants() {
  const {
    tenants, tenant, sessions, currentUser,
    createTenant, updateTenant, deleteTenant,
    getTenantUsers, createTenantUser, deleteTenantUser,
  } = usePortal()

  const isSuperAdmin = currentUser?.role === 'superadmin'

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateTenantForm>(emptyCreate)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState('free')
  const [editBusinessType, setEditBusinessType] = useState<LocalBusinessType>('service')
  const [editSuspended, setEditSuspended] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Users panel
  const [usersForTenant, setUsersForTenant] = useState<string | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [addUserForm, setAddUserForm] = useState({ username: '', password: '', role: 'agent' })
  const [addUserLoading, setAddUserLoading] = useState(false)
  const [addUserError, setAddUserError] = useState('')

  const loadUsers = async (tid: string) => {
    setUsersLoading(true)
    try {
      const users = await getTenantUsers(tid)
      setTenantUsers(users)
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    if (usersForTenant) loadUsers(usersForTenant)
  }, [usersForTenant])

  const handleCreate = async () => {
    setCreateError('')
    if (!createForm.name.trim() || !createForm.slug.trim() || !createForm.adminUsername.trim() || !createForm.adminPassword)
      return setCreateError('All fields are required.')
    setCreateLoading(true)
    try {
      await createTenant(createForm)
      setShowCreate(false)
      setCreateForm(emptyCreate)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create tenant.')
    } finally {
      setCreateLoading(false)
    }
  }

  const openEdit = (t: typeof tenants[0]) => {
    setEditId(t.id)
    setEditName(t.name)
    setEditPlan(t.plan)
    setEditBusinessType((t.businessType ?? 'service') as LocalBusinessType)
    setEditSuspended(t.suspended ?? false)
  }

  const handleEdit = async () => {
    if (!editId) return
    setEditLoading(true)
    try {
      await updateTenant(editId, { name: editName, plan: editPlan, businessType: editBusinessType, suspended: editSuspended })
      setEditId(null)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      await deleteTenant(deleteId)
      setDeleteId(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddUser = async () => {
    setAddUserError('')
    if (!addUserForm.username.trim() || !addUserForm.password) return setAddUserError('Username and password required.')
    setAddUserLoading(true)
    try {
      const u = await createTenantUser(usersForTenant!, addUserForm)
      setTenantUsers((prev) => [...prev, u])
      setAddUserForm({ username: '', password: '', role: 'agent' })
    } catch (e: unknown) {
      setAddUserError(e instanceof Error ? e.message : 'Failed to add user.')
    } finally {
      setAddUserLoading(false)
    }
  }

  const handleDeleteUser = async (uid: string) => {
    if (!usersForTenant) return
    await deleteTenantUser(usersForTenant, uid).catch(() => {})
    setTenantUsers((prev) => prev.filter((u) => u.id !== uid))
  }

  // â”€â”€ Super-admin view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tenant Management</h2>
            <p className="text-muted-foreground">
              Create and manage client workspaces. Each tenant has isolated WhatsApp sessions, contacts, and billing plans.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-2" /> New Tenant
          </Button>
        </div>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 font-bold text-primary text-sm">
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {t.name}
                          {t.id === tenant.id && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">current</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">/{t.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', PLAN_COLORS[t.plan])}>
                      {t.plan}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const bt = (t.businessType ?? 'service') as LocalBusinessType
                      const m = BUSINESS_TYPE_META[bt]
                      return (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {m.emoji} {m.label}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <button
                      className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                      onClick={() => setUsersForTenant(t.id)}
                    >
                      <Users className="size-3.5" />
                      {t.members.length} members
                    </button>
                  </TableCell>
                  <TableCell>
                    {t.suspended ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <XCircle className="size-3.5" /> Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="size-3.5" /> Active
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(t)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {t.id !== 't1' && (
                        <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Create Tenant Modal */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Workspace Name</Label>
                  <Input placeholder="Acme Store" value={createForm.name}
                    onChange={(e) => {
                      const name = e.target.value
                      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                      setCreateForm((p) => ({ ...p, name, slug }))
                    }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input placeholder="acme-store" value={createForm.slug}
                    onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={createForm.plan} onValueChange={(v) => setCreateForm((p) => ({ ...p, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free — 1 session, no broadcast</SelectItem>
                    <SelectItem value="pro">Pro — 3 sessions, broadcast</SelectItem>
                    <SelectItem value="business">Business — unlimited sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Business Type</Label>
                <Select value={createForm.businessType} onValueChange={(v) => setCreateForm((p) => ({ ...p, businessType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.emoji} {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-1 pb-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Account</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input placeholder="client_admin" value={createForm.adminUsername}
                    onChange={(e) => setCreateForm((p) => ({ ...p, adminUsername: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" placeholder="••••••••" value={createForm.adminPassword}
                    onChange={(e) => setCreateForm((p) => ({ ...p, adminPassword: e.target.value }))} />
                </div>
              </div>
              {createError && (
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" /> {createError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createLoading}>
                {createLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Tenant Modal */}
        <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Business Type</Label>
                <Select value={editBusinessType} onValueChange={(v) => setEditBusinessType(v as LocalBusinessType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.emoji} {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Suspended</div>
                  <div className="text-xs text-muted-foreground">Block this tenant from all services</div>
                </div>
                <Switch checked={editSuspended} onCheckedChange={setEditSuspended} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editLoading}>
                {editLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Tenant</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              This will permanently delete the tenant, all its users, and all its data. This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Users Panel */}
        <Dialog open={!!usersForTenant} onOpenChange={(o) => !o && setUsersForTenant(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Users — {tenants.find((t) => t.id === usersForTenant)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {usersLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-1">
                  {tenantUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No users yet.</p>
                  )}
                  {tenantUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 py-1.5">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-xs">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{u.username}</div>
                        <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                      </div>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteUser(u.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="size-3.5" /> Add User
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <Input className="col-span-2" placeholder="username"
                    value={addUserForm.username}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, username: e.target.value }))} />
                  <Input className="col-span-2" type="password" placeholder="password"
                    value={addUserForm.password}
                    onChange={(e) => setAddUserForm((p) => ({ ...p, password: e.target.value }))} />
                  <Select value={addUserForm.role} onValueChange={(v) => setAddUserForm((p) => ({ ...p, role: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">owner</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="agent">agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addUserError && <p className="text-xs text-destructive">{addUserError}</p>}
                <Button size="sm" onClick={handleAddUser} disabled={addUserLoading}>
                  {addUserLoading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                  Add User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // â”€â”€ Regular tenant user view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tenants & Team</h2>
        <p className="text-muted-foreground">
          Your workspace and team members.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tenants.map((t) => (
          <Card key={t.id} className={t.id === tenant.id ? 'border-primary' : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4" /> {t.name}
                </CardTitle>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', PLAN_COLORS[t.plan])}>
                  {t.plan}
                </span>
              </div>
              <CardDescription>
                /{t.slug} · created {new Date(t.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t.members.length} members ·{' '}
              {t.id === tenant.id ? `${sessions.length} sessions (this workspace)` : 'sessions isolated per tenant'}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members of {tenant.name}</CardTitle>
          <CardDescription>
            Roles: owner/admin get full access, agents get inbox access, viewers get read-only access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenant.members.map((m) => {
                const Icon = roleIcon[m.role as LocalTenantRole] ?? Eye
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback>{m.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        <Icon className="mr-1 size-3" /> {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-sm ${m.online ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        <span className={`size-2 rounded-full ${m.online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {m.online ? 'online' : 'offline'}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

