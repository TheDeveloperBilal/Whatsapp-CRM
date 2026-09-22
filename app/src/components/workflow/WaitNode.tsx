import { Handle, Position } from '@xyflow/react'
import { Clock } from 'lucide-react'

export function WaitNode({ data, selected }: any) {
  const { amount = 1, unit = 'minutes' } = data.config || {}
  return (
    <div className={`bg-orange-500 text-white rounded-xl px-4 py-3 min-w-[200px] shadow-lg border-2 ${selected ? 'border-orange-200 ring-2 ring-orange-300' : 'border-orange-600'}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-200" />
      <div className="flex items-center gap-2 mb-1">
        <Clock className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Wait</span>
      </div>
      <div className="font-semibold text-sm">Wait {amount} {unit}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-200" />
    </div>
  )
}
