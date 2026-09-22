import { Handle, Position } from '@xyflow/react'
import { MessageSquare, Tag, User, Globe, FileText, TrendingUp, Send } from 'lucide-react'

const ACTION_ICONS: Record<string, any> = {
  send_message: MessageSquare, add_tag: Tag, remove_tag: Tag,
  assign_agent: User, send_webhook: Globe, create_note: FileText,
  move_deal_stage: TrendingUp, create_deal: TrendingUp,
  add_to_campaign: Send, remove_from_campaign: Send,
  set_contact_field: User,
}

const ACTION_COLORS: Record<string, string> = {
  send_message: 'bg-blue-500 border-blue-600',
  add_tag: 'bg-purple-500 border-purple-600',
  remove_tag: 'bg-purple-500 border-purple-600',
  assign_agent: 'bg-indigo-500 border-indigo-600',
  send_webhook: 'bg-gray-600 border-gray-700',
  create_note: 'bg-yellow-500 border-yellow-600',
  move_deal_stage: 'bg-orange-500 border-orange-600',
  create_deal: 'bg-orange-500 border-orange-600',
  add_to_campaign: 'bg-pink-500 border-pink-600',
  set_contact_field: 'bg-cyan-500 border-cyan-600',
}

export function ActionNode({ data, selected }: any) {
  const Icon = ACTION_ICONS[data.actionType] || MessageSquare
  const colorClass = ACTION_COLORS[data.actionType] || 'bg-blue-500 border-blue-600'
  return (
    <div className={`text-white rounded-xl px-4 py-3 min-w-[200px] shadow-lg border-2 ${colorClass} ${selected ? 'ring-2 ring-white ring-offset-2' : ''}`}>
      <Handle type="target" position={Position.Top} className="!bg-white/50" />
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Action</span>
      </div>
      <div className="font-semibold text-sm">{data.label}</div>
      {data.config?.message && <div className="text-xs opacity-70 mt-0.5 truncate max-w-[180px]">"{data.config.message}"</div>}
      {data.config?.tag && <div className="text-xs opacity-70 mt-0.5">Tag: {data.config.tag}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-white/50" />
    </div>
  )
}
