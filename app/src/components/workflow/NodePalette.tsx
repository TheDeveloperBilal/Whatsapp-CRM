import { MessageSquare, Clock, GitBranch, Square, Tag, User, Globe, FileText, TrendingUp, Send, UserMinus } from 'lucide-react'

const PALETTE_ITEMS = [
  { section: 'Actions', items: [
    { type: 'action', actionType: 'send_message', label: 'Send WhatsApp', icon: MessageSquare, color: 'text-blue-500' },
    { type: 'action', actionType: 'add_tag', label: 'Add Tag', icon: Tag, color: 'text-purple-500' },
    { type: 'action', actionType: 'remove_tag', label: 'Remove Tag', icon: Tag, color: 'text-purple-400' },
    { type: 'action', actionType: 'assign_agent', label: 'Assign Agent', icon: User, color: 'text-indigo-500' },
    { type: 'action', actionType: 'unassign_agent', label: 'Unassign Agent', icon: UserMinus, color: 'text-indigo-400' },
    { type: 'action', actionType: 'set_contact_field', label: 'Update Contact', icon: User, color: 'text-cyan-500' },
    { type: 'action', actionType: 'create_note', label: 'Create Note', icon: FileText, color: 'text-yellow-500' },
    { type: 'action', actionType: 'move_deal_stage', label: 'Move Deal Stage', icon: TrendingUp, color: 'text-orange-500' },
    { type: 'action', actionType: 'create_deal', label: 'Create Deal', icon: TrendingUp, color: 'text-orange-400' },
    { type: 'action', actionType: 'add_to_campaign', label: 'Add to Campaign', icon: Send, color: 'text-pink-500' },
    { type: 'action', actionType: 'send_webhook', label: 'Send Webhook', icon: Globe, color: 'text-gray-500' },
  ]},
  { section: 'Logic', items: [
    { type: 'condition', label: 'If / Else', icon: GitBranch, color: 'text-yellow-500' },
    { type: 'wait', label: 'Wait / Delay', icon: Clock, color: 'text-orange-500' },
    { type: 'end', label: 'End', icon: Square, color: 'text-gray-500' },
  ]},
]

export function NodePalette({ onAdd }: { onAdd: (type: string, actionType?: string) => void }) {
  return (
    <div className="w-56 border-r bg-muted/30 overflow-y-auto flex-shrink-0">
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Step</p>
      </div>
      {PALETTE_ITEMS.map(section => (
        <div key={section.section} className="p-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{section.section}</p>
          {section.items.map(item => (
            <button
              key={(item as any).actionType || item.type}
              onClick={() => onAdd(item.type, (item as any).actionType)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent text-left text-sm font-medium transition-colors"
            >
              <item.icon className={`size-4 shrink-0 ${item.color}`} />
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
