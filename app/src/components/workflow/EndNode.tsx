import { Handle, Position } from '@xyflow/react'
import { Square } from 'lucide-react'

export function EndNode({ data: _data, selected }: any) {
  return (
    <div className={`bg-gray-600 text-white rounded-xl px-4 py-3 min-w-[180px] shadow-lg border-2 ${selected ? 'border-gray-300 ring-2 ring-gray-400' : 'border-gray-700'}`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-2">
        <Square className="size-4" />
        <span className="font-semibold text-sm">End Workflow</span>
      </div>
    </div>
  )
}
