'use client'

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { executeToolCalls } from '@/lib/ai-scene-generation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export function AiPanel() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selection = useViewer((state) => state.selection)
  const scene = useScene((state) => state)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: prompt }])
    setLoading(true)

    try {
      // Get scene context for AI
      const sceneContext = {
        currentLevelId: selection?.levelId,
        currentBuildingId: selection?.buildingId,
        prompt: 'User is designing house layouts. Suggest realistic architectural elements.',
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sceneContext }),
      })

      const { toolCalls, message } = await response.json()

      // Add AI response
      setMessages((prev) => [...prev, { role: 'assistant', content: message }])

      // Execute tool calls to create rooms/elements
      if (toolCalls && toolCalls.length > 0 && selection?.levelId) {
        try {
          console.log(`Executing ${toolCalls.length} tool calls...`, toolCalls)
          const createdIds = await executeToolCalls(toolCalls, selection.levelId)
          console.log(`Created ${createdIds.length} scene elements`)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `✅ Created ${createdIds.length} elements in the scene!`,
            },
          ])
        } catch (error) {
          console.error('Tool execution error:', error)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '❌ Error creating elements' },
          ])
        }
      } else if (toolCalls && toolCalls.length > 0 && !selection?.levelId) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Please select a level in the Scene tab first' },
        ])
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error processing request. Please try again.' },
      ])
    } finally {
      setLoading(false)
      setPrompt('')
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">AI Designer</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground space-y-2">
              <Sparkles className="h-8 w-8 mx-auto opacity-50" />
              <p className="text-sm font-medium">Describe what you want to build</p>
              <p className="text-xs">
                Example: "Add a 4m × 4m bedroom with a door and window"
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground px-4 py-2 rounded-lg text-sm">
              <span className="inline-block animate-pulse">Designing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-border border-t p-4 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the room..."
          disabled={loading}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg px-4 py-2 font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default AiPanel
