import { useState } from 'react'
import { usePortal } from '@/lib/portal-context'
import type { AppointmentType, Appointment, AppointmentStatus } from '@/types/portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Clock, DollarSign, CalendarDays, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDuration(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function fmtPrice(price: number, currency: string) {
  if (price === 0) return 'Free'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price)
}

const STATUS_META: Record<AppointmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',       icon: <XCircle className="h-3.5 w-3.5" /> },
}

// â”€â”€ Appointment Type Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TypeCard({ at, onEdit, onDelete }: { at: AppointmentType; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{at.name}</p>
            {!at.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
          </div>
          {at.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{at.description}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <Clock className="h-4 w-4 text-blue-500" />
          {fmtDuration(at.duration)}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <DollarSign className="h-4 w-4 text-green-500" />
          {fmtPrice(at.price, at.currency)}
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Appointment Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ApptRow({ appt, types, contacts, onEdit, onDelete }: {
  appt: Appointment
  types: AppointmentType[]
  contacts: ReturnType<typeof usePortal>['contacts']
  onEdit: () => void
  onDelete: () => void
}) {
  const type = types.find((t) => t.id === appt.appointmentTypeId)
  const contact = contacts.find((c) => c.id === appt.contactId)
  const meta = STATUS_META[appt.status] ?? STATUS_META.confirmed
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="w-14 flex-shrink-0 text-center">
        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{new Date(appt.date).toLocaleDateString('en', { month: 'short' })}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">{new Date(appt.date).getDate()}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{contact?.name ?? appt.contactId}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{type?.name ?? '—'} · {appt.time}</p>
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${meta.color}`}>
        {meta.icon}
        {meta.label}
      </div>
      <div className="flex gap-1">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EMPTY_TYPE = { name: '', duration: 60, price: 0, currency: 'USD', description: '', active: true }
const EMPTY_APPT = { contactId: '', appointmentTypeId: '', date: '', time: '10:00', status: 'confirmed' as AppointmentStatus, notes: '' }

export default function Booking() {
  const { appointmentTypes, appointments, contacts, createAppointmentType, updateAppointmentType, deleteAppointmentType, createAppointment, updateAppointment, deleteAppointment } = usePortal()

  // Type dialog
  const [typeDialog, setTypeDialog] = useState<{ open: boolean; at?: AppointmentType }>({ open: false })
  const [typeForm, setTypeForm] = useState({ ...EMPTY_TYPE })

  // Appointment dialog
  const [apptDialog, setApptDialog] = useState<{ open: boolean; appt?: Appointment }>({ open: false })
  const [apptForm, setApptForm] = useState({ ...EMPTY_APPT })

  // â”€â”€ Type actions â”€â”€
  const openNewType = () => { setTypeForm({ ...EMPTY_TYPE }); setTypeDialog({ open: true }) }
  const openEditType = (at: AppointmentType) => { setTypeForm({ name: at.name, duration: at.duration, price: at.price, currency: at.currency, description: at.description, active: at.active }); setTypeDialog({ open: true, at }) }

  const handleSaveType = async () => {
    if (!typeForm.name.trim()) return
    const data = { ...typeForm, duration: Number(typeForm.duration), price: Number(typeForm.price) }
    if (typeDialog.at) await updateAppointmentType(typeDialog.at.id, data)
    else await createAppointmentType(data)
    setTypeDialog({ open: false })
  }

  const handleDeleteType = async (id: string) => {
    if (!confirm('Delete this appointment type?')) return
    await deleteAppointmentType(id)
  }

  // â”€â”€ Appointment actions â”€â”€
  const openNewAppt = () => { setApptForm({ ...EMPTY_APPT, date: new Date().toISOString().slice(0, 10) }); setApptDialog({ open: true }) }
  const openEditAppt = (appt: Appointment) => {
    setApptForm({ contactId: appt.contactId, appointmentTypeId: appt.appointmentTypeId, date: appt.date, time: appt.time, status: appt.status, notes: appt.notes })
    setApptDialog({ open: true, appt })
  }

  const handleSaveAppt = async () => {
    if (!apptForm.contactId || !apptForm.appointmentTypeId || !apptForm.date || !apptForm.time) return
    if (apptDialog.appt) await updateAppointment(apptDialog.appt.id, apptForm)
    else await createAppointment(apptForm)
    setApptDialog({ open: false })
  }

  const handleDeleteAppt = async (id: string) => {
    if (!confirm('Delete this appointment?')) return
    await deleteAppointment(id)
  }

  // â”€â”€ Stats â”€â”€
  const upcoming = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.date >= new Date().toISOString().slice(0, 10))
  const completed = appointments.filter((a) => a.status === 'completed')
  const sorted = [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: upcoming.length, icon: <CalendarDays className="h-5 w-5 text-blue-500" /> },
          { label: 'Completed', value: completed.length, icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> },
          { label: 'Service Types', value: appointmentTypes.length, icon: <Clock className="h-5 w-5 text-purple-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            {icon}
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="appointments">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="types">Service Types</TabsTrigger>
          </TabsList>
          <div>
            <TabsContent value="appointments" className="mt-0">
              <Button onClick={openNewAppt} size="sm"><Plus className="h-4 w-4 mr-1" />Book Appointment</Button>
            </TabsContent>
            <TabsContent value="types" className="mt-0">
              <Button onClick={openNewType} size="sm"><Plus className="h-4 w-4 mr-1" />Add Service Type</Button>
            </TabsContent>
          </div>
        </div>

        <TabsContent value="appointments" className="mt-4 space-y-2">
          {sorted.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No appointments yet</p>
              <p className="text-sm">Book your first appointment above</p>
            </div>
          )}
          {sorted.map((appt) => (
            <ApptRow
              key={appt.id}
              appt={appt}
              types={appointmentTypes}
              contacts={contacts}
              onEdit={() => openEditAppt(appt)}
              onDelete={() => handleDeleteAppt(appt.id)}
            />
          ))}
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          {appointmentTypes.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No service types yet</p>
              <p className="text-sm">Add your first service type above</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointmentTypes.map((at) => (
              <TypeCard
                key={at.id}
                at={at}
                onEdit={() => openEditType(at)}
                onDelete={() => handleDeleteType(at.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Service Type Dialog */}
      <Dialog open={typeDialog.open} onOpenChange={(o) => !o && setTypeDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{typeDialog.at ? 'Edit Service Type' : 'New Service Type'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={typeForm.name} onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Consultation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" value={typeForm.duration} onChange={(e) => setTypeForm((f) => ({ ...f, duration: Number(e.target.value) }))} min={5} step={5} />
              </div>
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input type="number" value={typeForm.price} onChange={(e) => setTypeForm((f) => ({ ...f, price: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={typeForm.currency} onValueChange={(v) => setTypeForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['USD', 'EUR', 'GBP', 'PKR', 'AED', 'SAR', 'INR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={typeForm.description} onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description…" rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={typeForm.active} onCheckedChange={(v) => setTypeForm((f) => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveType} disabled={!typeForm.name.trim()}>{typeDialog.at ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Dialog */}
      <Dialog open={apptDialog.open} onOpenChange={(o) => !o && setApptDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{apptDialog.appt ? 'Edit Appointment' : 'Book Appointment'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Contact *</Label>
              <Select value={apptForm.contactId || 'none'} onValueChange={(v) => setApptForm((f) => ({ ...f, contactId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select contact —</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service Type *</Label>
              <Select value={apptForm.appointmentTypeId || 'none'} onValueChange={(v) => setApptForm((f) => ({ ...f, appointmentTypeId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select service —</SelectItem>
                  {appointmentTypes.filter((t) => t.active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({fmtDuration(t.duration)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={apptForm.date} onChange={(e) => setApptForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Time *</Label>
                <Input type="time" value={apptForm.time} onChange={(e) => setApptForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={apptForm.status} onValueChange={(v) => setApptForm((f) => ({ ...f, status: v as AppointmentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={apptForm.notes} onChange={(e) => setApptForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApptDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleSaveAppt} disabled={!apptForm.contactId || !apptForm.appointmentTypeId || !apptForm.date || !apptForm.time}>
              {apptDialog.appt ? 'Save' : 'Book'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

