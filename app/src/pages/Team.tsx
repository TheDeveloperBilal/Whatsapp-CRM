import { useState } from 'react'
import { usePortal } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, KeyRound, Users, Layers, X } from 'lucide-react'
import type { Department, Agent } from '@/types/portal'

const DEPT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6']

export default function Team() {
  const {
    tenant, currentUser,
    departments, createDepartment, updateDepartment, deleteDepartment,
    agents, createAgent, updateAgent, deleteAgent, changeAgentPassword,
  } = usePortal()

  const [tab, setTab] = useState<'departments' | 'agents'>('departments')

  // ── Department state ────────────────────────────────────────────────────────
  const [deptDialog, setDeptDialog] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptName, setDeptName] = useState('')
  const [deptColor, setDeptColor] = useState(DEPT_COLORS[0])
  const [deptKeywords, setDeptKeywords] = useState('')
  const [deptSaving, setDeptSaving] = useState(false)

  function openNewDept() {
    setEditingDept(null)
    setDeptName('')
    setDeptColor(DEPT_COLORS[0])
    setDeptKeywords('')
    setDeptDialog(true)
  }

  function openEditDept(d: Department) {
    setEditingDept(d)
    setDeptName(d.name)
    setDeptColor(d.color || DEPT_COLORS[0])
    setDeptKeywords((d.keywords || []).join(', '))
    setDeptDialog(true)
  }

  async function saveDept() {
    if (!deptName.trim()) return
    setDeptSaving(true)
    const keywords = deptKeywords.split(',').map(k => k.trim()).filter(Boolean)
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, { name: deptName.trim(), color: deptColor, keywords })
        toast.success('Department updated')
      } else {
        await createDepartment({ name: deptName.trim(), color: deptColor, keywords })
        toast.success('Department created')
      }
      setDeptDialog(false)
    } catch {
      toast.error('Failed to save department')
    } finally {
      setDeptSaving(false)
    }
  }

  async function handleDeleteDept(id: string) {
    try {
      await deleteDepartment(id)
      toast.success('Department deleted')
    } catch {
      toast.error('Failed to delete department')
    }
  }

  // ── Agent state ─────────────────────────────────────────────────────────────
  const [agentDialog, setAgentDialog] = useState(false)
  const [pwDialog, setPwDialog] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [agentUsername, setAgentUsername] = useState('')
  const [agentPassword, setAgentPassword] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentRole, setAgentRole] = useState<'admin' | 'agent'>('agent')
  const [agentDeptId, setAgentDeptId] = useState<string>('none')
  const [agentSaving, setAgentSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  function openNewAgent() {
    setEditingAgent(null)
    setAgentUsername('')
    setAgentPassword('')
    setAgentName('')
    setAgentRole('agent')
    setAgentDeptId('none')
    setAgentDialog(true)
  }

  function openEditAgent(a: Agent) {
    setEditingAgent(a)
    setAgentUsername(a.username)
    setAgentPassword('')
    setAgentName(a.name)
    setAgentRole(a.role === 'owner' ? 'agent' : a.role)
    setAgentDeptId(a.departmentId || 'none')
    setAgentDialog(true)
  }

  function openChangePassword(a: Agent) {
    setEditingAgent(a)
    setNewPassword('')
    setPwDialog(true)
  }

  async function saveAgent() {
    if (!agentUsername.trim()) return
    setAgentSaving(true)
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, {
          name: agentName.trim() || agentUsername.trim(),
          role: agentRole,
          departmentId: agentDeptId === 'none' ? null : agentDeptId,
        })
        toast.success('Agent updated')
      } else {
        if (!agentPassword) { toast.error('Password is required'); setAgentSaving(false); return }
        await createAgent({
          username: agentUsername.trim(),
          password: agentPassword,
          name: agentName.trim() || agentUsername.trim(),
          role: agentRole,
          departmentId: agentDeptId === 'none' ? undefined : agentDeptId,
        })
        toast.success('Agent created')
      }
      setAgentDialog(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save agent')
    } finally {
      setAgentSaving(false)
    }
  }

  async function handleDeleteAgent(id: string) {
    try {
      await deleteAgent(id)
      toast.success('Agent removed')
    } catch {
      toast.error('Failed to remove agent')
    }
  }

  async function handleChangePassword() {
    if (!editingAgent || !newPassword) return
    setPwSaving(true)
    try {
      await changeAgentPassword(editingAgent.id, newPassword)
      toast.success('Password changed')
      setPwDialog(false)
    } catch {
      toast.error('Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin'

  const getDeptName = (id: string | null) => {
    if (!id) return null
    return departments.find(d => d.id === id)?.name ?? null
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'departments' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="size-4" />
          Departments
        </button>
        <button
          onClick={() => setTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'agents' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="size-4" />
          Team Members
        </button>
      </div>

      {/* ── Departments tab ── */}
      {tab === 'departments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Departments</h2>
              <p className="text-sm text-gray-500 mt-0.5">Route incoming chats automatically using keywords</p>
            </div>
            {canManage && (
              <Button onClick={openNewDept} size="sm" className="gap-2">
                <Plus className="size-4" /> New Department
              </Button>
            )}
          </div>

          {departments.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Layers className="size-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No departments yet</p>
              <p className="text-sm mt-1">Create departments to enable automatic chat routing</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {departments.map(dept => (
                <div
                  key={dept.id}
                  className="flex items-start gap-3 p-4 rounded-xl border bg-white shadow-sm"
                >
                  <div
                    className="size-3 rounded-full shrink-0 mt-1.5"
                    style={{ background: dept.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800">{dept.name}</div>
                    {dept.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dept.keywords.map(kw => (
                          <span key={kw} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1.5">
                      {agents.filter(a => a.departmentId === dept.id).length} agents
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditDept(dept)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(dept.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Agents tab ── */}
      {tab === 'agents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Team Members</h2>
              <p className="text-sm text-gray-500 mt-0.5">Agents who handle chats for {tenant?.name}</p>
            </div>
            {canManage && (
              <Button onClick={openNewAgent} size="sm" className="gap-2">
                <Plus className="size-4" /> Add Member
              </Button>
            )}
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="size-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No team members yet</p>
              <p className="text-sm mt-1">Add agents to assign and route conversations</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent, i) => (
                    <tr key={agent.id} className={i < agents.length - 1 ? 'border-b' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="size-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                          >
                            {(agent.name || agent.username).slice(0, 1).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{agent.name || agent.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">@{agent.username}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={agent.role === 'owner' ? 'default' : agent.role === 'admin' ? 'secondary' : 'outline'}
                          className="text-[11px]"
                        >
                          {agent.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {agent.departmentId ? (
                          <span
                            className="text-[12px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: `${departments.find(d => d.id === agent.departmentId)?.color || '#6366f1'}20`,
                              color: departments.find(d => d.id === agent.departmentId)?.color || '#6366f1',
                            }}
                          >
                            {getDeptName(agent.departmentId) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => openChangePassword(agent)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Change password"
                            >
                              <KeyRound className="size-3.5" />
                            </button>
                            <button
                              onClick={() => openEditAgent(agent)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            {agent.role !== 'owner' && (
                              <button
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Department dialog ── */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'New Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                placeholder="e.g. Billing, Sales, Support"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Color</label>
              <div className="flex gap-2 mt-1.5">
                {DEPT_COLORS.map(c => (
                  <button
                    key={c}
                    className={`size-6 rounded-full transition-transform ${deptColor === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : 'hover:scale-110'}`}
                    style={{ background: c }}
                    onClick={() => setDeptColor(c)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Routing Keywords</label>
              <Input
                value={deptKeywords}
                onChange={e => setDeptKeywords(e.target.value)}
                placeholder="billing, invoice, payment (comma separated)"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Incoming messages matching these keywords are auto-routed to this department
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialog(false)}>Cancel</Button>
            <Button onClick={saveDept} disabled={deptSaving || !deptName.trim()}>
              {deptSaving ? 'Saving…' : editingDept ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Agent dialog ── */}
      <Dialog open={agentDialog} onOpenChange={setAgentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Username</label>
                <Input
                  value={agentUsername}
                  onChange={e => setAgentUsername(e.target.value)}
                  placeholder="john"
                  className="mt-1"
                  disabled={!!editingAgent}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Display Name</label>
                <Input
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1"
                />
              </div>
            </div>
            {!editingAgent && (
              <div>
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  value={agentPassword}
                  onChange={e => setAgentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={agentRole} onValueChange={(v) => setAgentRole(v as 'admin' | 'agent')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Department</label>
                <Select value={agentDeptId} onValueChange={setAgentDeptId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialog(false)}>Cancel</Button>
            <Button onClick={saveAgent} disabled={agentSaving || !agentUsername.trim()}>
              {agentSaving ? 'Saving…' : editingAgent ? 'Save' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change password dialog ── */}
      <Dialog open={pwDialog} onOpenChange={setPwDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password — {editingAgent?.name || editingAgent?.username}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={pwSaving || !newPassword}>
              {pwSaving ? 'Saving…' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
