'use client'

import { useViewer } from '@pascal-app/viewer'
import { Lightbulb } from 'lucide-react'
import { useRef, useState } from 'react'
import { executeToolCalls } from '@/lib/ai-scene-generation'

interface HousePlan {
  summary: string
  rooms: Array<{
    id: string
    name: string
    type: string
    dimensions: { width: number; depth: number }
  }>
  layout: {
    gridSize: number
    totalArea: number
    roomArrangement: string
    notes: string
  }
  furniture: Record<string, string[]>
  outdoor: string[]
}

export function PlannerPanel() {
  const [houseType, setHouseType] = useState('2BHK')
  const [roomCount, setRoomCount] = useState(5)
  const [areaPreference, setAreaPreference] = useState('Medium')
  const [preferences, setPreferences] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState<HousePlan | null>(null)
  const selection = useViewer((state) => state.selection)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleCreateAndExecute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selection?.levelId) {
      setStatus('❌ Please select a level in the Scene tab first')
      return
    }

    setLoading(true)
    setStatus('🔄 Generating optimized house plan...')
    setPlan(null)

    try {
      // Step 1: Create plan
      const planRes = await fetch('/api/planner/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseType,
          roomCount,
          areaPreference,
          preferences,
          levelId: selection.levelId,
        }),
      })

      if (!planRes.ok) throw new Error('Failed to generate plan')
      const { plan: generatedPlan } = await planRes.json()
      setPlan(generatedPlan)

      // Step 2: Convert plan to tool calls
      setStatus('🔄 Converting plan to scene operations...')
      const execRes = await fetch('/api/planner/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: generatedPlan,
          levelId: selection.levelId,
        }),
      })

      if (!execRes.ok) throw new Error('Failed to execute plan')
      const { toolCalls } = await execRes.json()

      // Step 3: Execute tool calls to create scene
      setStatus('🔄 Creating 3D scene from plan...')
      const createdIds = await executeToolCalls(toolCalls, selection.levelId)

      setStatus(`✅ House created successfully with ${createdIds.length} scene elements!`)
    } catch (error) {
      console.error('Error:', error)
      setStatus(
        `❌ ${error instanceof Error ? error.message : 'Error creating house. Please try again.'}`
      )
    } finally {
      setLoading(false)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">House Planner</span>
      </div>

      {/* Form */}
      <form onSubmit={handleCreateAndExecute} className="space-y-4 border-border border-b p-4">
        {/* House Type */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            House Type
          </label>
          <select
            value={houseType}
            onChange={(e) => setHouseType(e.target.value)}
            disabled={loading}
            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground disabled:opacity-50"
          >
            <option>1BHK</option>
            <option>2BHK</option>
            <option>3BHK</option>
            <option>Villa</option>
            <option>Apartment</option>
          </select>
        </div>

        {/* Room Count */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Total Rooms: {roomCount}
          </label>
          <input
            type="range"
            min="2"
            max="8"
            value={roomCount}
            onChange={(e) => setRoomCount(parseInt(e.target.value))}
            disabled={loading}
            className="w-full disabled:opacity-50"
          />
        </div>

        {/* Area Preference */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Area Preference
          </label>
          <select
            value={areaPreference}
            onChange={(e) => setAreaPreference(e.target.value)}
            disabled={loading}
            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground disabled:opacity-50"
          >
            <option>Compact</option>
            <option>Medium</option>
            <option>Large</option>
            <option>Spacious</option>
          </select>
        </div>

        {/* Preferences */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Additional Preferences (optional)
          </label>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            disabled={loading}
            placeholder="e.g., Open kitchen, modern style, lots of light..."
            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground resize-none disabled:opacity-50"
            rows={2}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded px-3 py-2 font-medium text-sm transition-colors"
        >
          {loading ? 'Creating Plan...' : 'Create & Execute Plan'}
        </button>
      </form>

      {/* Status & Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {status && (
          <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            {status}
          </div>
        )}

        {plan && (
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <div>
              <h3 className="font-medium text-foreground text-sm mb-1">Plan Summary</h3>
              <p className="text-xs text-muted-foreground">{plan.summary}</p>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-sm mb-1">Rooms</h3>
              <div className="space-y-1">
                {plan.rooms.map((room) => (
                  <div key={room.id} className="text-xs text-muted-foreground">
                    • {room.name} ({room.dimensions.width}m × {room.dimensions.depth}m)
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-foreground text-sm mb-1">Layout</h3>
              <p className="text-xs text-muted-foreground">
                {plan.layout.totalArea}m² | {plan.layout.roomArrangement}
              </p>
              {plan.layout.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{plan.layout.notes}</p>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default PlannerPanel
