import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type NodeTypes, BackgroundVariant,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Save, Play, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { usePortal } from '@/lib/store'
import type { Workflow } from '@/types/portal'
import { TriggerNode } from '@/components/workflow/TriggerNode'
import { ActionNode } from '@/components/workflow/ActionNode'
import { ConditionNode } from '@/components/workflow/ConditionNode'
import { WaitNode } from '@/components/workflow/WaitNode'
import { EndNode } from '@/components/workflow/EndNode'
import { NodeConfigPanel } from '@/components/workflow/NodeConfigPanel'
import { NodePalette } from '@/components/workflow/NodePalette'
import { toast } from 'sonner'

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  end: EndNode,
}

function getDefaultNodes(triggerType = 'contact.created') {
  return [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        label: 'Trigger',
        nodeType: 'trigger',
        triggerType,
        config: {},
        description: 'When this event fires...',
      },
    },
    {
      id: 'end-1',
      type: 'end',
      position: { x: 250, y: 220 },
      data: { label: 'End', nodeType: 'end', config: {} },
    },
  ]
}

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant, client } = usePortal()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [name, setName] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [showPalette, setShowPalette] = useState(true)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tenant || !id) return
    client.workflows(tenant.id).then((list: Workflow[]) => {
      const wf = list.find(w => w.id === id)
      if (wf) {
        setWorkflow(wf)
        setName(wf.name)
        setNodes((wf.nodes as any[]).length > 0 ? (wf.nodes as any[]) : getDefaultNodes(wf.triggerType))
        setEdges(wf.edges as any[] || [])
      }
    }).catch(() => {})
  }, [tenant, id, client])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true }, eds))
  }, [setEdges])

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...(n as any).data, ...newData } } : n))
    setSelectedNode((prev: any) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev)
  }, [setNodes])

  const addNode = useCallback((type: string, actionType?: string) => {
    const nodeId = `${type}-${Date.now()}`
    const yOffset = nodes.length > 0 ? Math.max(...nodes.map((n: any) => n.position.y)) + 150 : 200
    const newNode: any = {
      id: nodeId,
      type,
      position: { x: 250, y: yOffset },
      data: {
        label: actionType
          ? actionType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : type.charAt(0).toUpperCase() + type.slice(1),
        nodeType: type,
        actionType,
        config: {},
      },
    }
    setNodes(nds => [...nds, newNode])
  }, [nodes, setNodes])

  const handleSave = async () => {
    if (!tenant || !id) return
    setSaving(true)
    try {
      const triggerNode = (nodes as any[]).find(n => n.data.nodeType === 'trigger')
      const updated = await client.updateWorkflow(tenant.id, id, {
        name,
        nodes: nodes as any,
        edges: edges as any,
        triggerType: triggerNode?.data.triggerType || 'manual',
        triggerConfig: triggerNode?.data.config || {},
      })
      setWorkflow(updated)
      toast.success('Workflow saved')
    } catch {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  const handleTest = async () => {
    if (!tenant || !id) return
    try {
      await client.triggerWorkflow(tenant.id, id, {})
      toast.success('Workflow triggered manually')
    } catch {
      toast.error('Failed to trigger')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 w-56 font-medium"
          placeholder="Workflow name"
        />
        <Badge variant={workflow?.enabled ? 'default' : 'secondary'} className="text-[10px]">
          {workflow?.enabled ? 'Active' : 'Draft'}
        </Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setShowPalette(p => !p)} className="gap-1.5">
          <Plus className="size-3.5" /> Add Step
        </Button>
        <Button variant="outline" size="sm" onClick={handleTest} className="gap-1.5">
          <Play className="size-3.5" /> Test
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        {showPalette && (
          <NodePalette onAdd={addNode} />
        )}

        {/* Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={(data) => updateNodeData(selectedNode.id, data)}
            onDelete={() => {
              setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
              setEdges(eds => eds.filter(e => (e as any).source !== selectedNode.id && (e as any).target !== selectedNode.id))
              setSelectedNode(null)
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}
