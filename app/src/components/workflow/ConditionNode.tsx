import { Handle, Position } from '@xyflow/react'
import { GitBranch } from 'lucide-react'

export function ConditionNode({ data, selected }: any) {
  return (
    <div className={`bg-yellow-500 text-white rounded-xl px-4 py-3 min-w-[200px] shadow-lg border-2 ${selected ? 'border-yellow-200 ring-2 ring-yellow-300' : 'border-yellow-600'}`}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-200" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Condition</span>
      </div>
      <div className="font-semibold text-sm">{data.label}</div>
      {data.config?.field && (
        <div className="text-xs opacity-70 mt-0.5">{data.config.field} {data.config.operator} "{data.config.value}"</div>
      )}
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="!bg-green-400" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="!bg-red-400" />
      <div className="flex justify-between text-[10px] mt-2 opacity-70 px-1">
        <span>YES</span><span>NO</span>
      </div>
    </div>
  )
}
