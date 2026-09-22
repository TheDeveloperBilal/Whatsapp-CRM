import { Handle, Position } from '@xyflow/react'
import { Zap } from 'lucide-react'

const TRIGGER_LABELS: Record<string, string> = {
  'contact.created': 'Contact Created', 'tag.added': 'Tag Added', 'tag.removed': 'Tag Removed',
  'message.received': 'Message Received', 'message.first': 'First Message',
  'conversation.resolved': 'Conversation Resolved', 'appointment.booked': 'Appointment Booked',
  'payment.received': 'Payment Received', 'deal.stage_changed': 'Deal Stage Changed',
  'form.submitted': 'Form Submitted', 'manual': 'Manual Trigger',
}

export function TriggerNode({ data, selected }: any) {
  return (
    <div className={`bg-green-500 text-white rounded-xl px-4 py-3 min-w-[200px] shadow-lg border-2 ${selected ? 'border-green-300' : 'border-green-600'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Zap className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Trigger</span>
      </div>
      <div className="font-semibold text-sm">{TRIGGER_LABELS[data.triggerType] || data.label}</div>
      {data.description && <div className="text-xs opacity-70 mt-0.5">{data.description}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-green-300 !border-green-700" />
    </div>
  )
}
