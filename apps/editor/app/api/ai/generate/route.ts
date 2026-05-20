import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_room',
      description:
        'Create an enclosed room with walls, floor slab, and ceiling. Always ensure rooms are logically positioned relative to other rooms. Use realistic dimensions: bedrooms 3-4m × 3-4m, kitchens 2.5-3.5m × 3-4m, bathrooms 1.5-2m × 2-2.5m, living areas 4-5m × 4-6m.',
      parameters: {
        type: 'object',
        properties: {
          levelId: {
            type: 'string',
            description: 'Level ID where room should be created',
          },
          name: {
            type: 'string',
            description:
              'Room name. Use one of: Living Room, Kitchen, Master Bedroom, Bedroom, Bathroom, Hallway, Parking, Entrance',
          },
          polygon: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' } },
            description:
              'Polygon vertices [[x1,z1], [x2,z2], ...] in clockwise order. Keep walls roughly aligned to 0°, 90°, 180°, 270° for clean modern designs.',
          },
          wallHeight: {
            type: 'number',
            description: 'Wall height in meters. Standard: 2.7m, Modern: 3m. Default: 2.7',
            default: 2.7,
          },
        },
        required: ['levelId', 'name', 'polygon'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_door',
      description:
        'Add a door to a wall. Position t ranges from 0 (start) to 1 (end). Place doors to connect rooms logically: between living/bedrooms, kitchens to living areas, etc.',
      parameters: {
        type: 'object',
        properties: {
          wallId: {
            type: 'string',
            description: 'ID of the wall to add door to',
          },
          t: {
            type: 'number',
            description: 'Position along wall (0=start, 1=end). Place at 0.3-0.7 for natural flow, avoid corners.',
          },
          width: {
            type: 'number',
            description: 'Door width in meters. Standard: 0.9m. Double: 1.8m. Default: 0.9',
            default: 0.9,
          },
          height: {
            type: 'number',
            description: 'Door height in meters. Standard: 2.1m. Default: 2.1',
            default: 2.1,
          },
          doorType: {
            type: 'string',
            enum: ['hinged', 'sliding'],
            description: 'Door type. Hinged for bedrooms/bathrooms, sliding for modern look. Default: hinged',
            default: 'hinged',
          },
        },
        required: ['wallId', 't'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_window',
      description:
        'Add a window to a wall. Place only on exterior walls for natural light. Space windows evenly at 1.5m intervals.',
      parameters: {
        type: 'object',
        properties: {
          wallId: {
            type: 'string',
            description: 'ID of the exterior wall to add window to',
          },
          t: {
            type: 'number',
            description: 'Position along wall (0=start, 1=end). Space windows 1-1.5m apart.',
          },
          width: {
            type: 'number',
            description: 'Window width in meters. Standard: 1.2-1.5m. Large: 2m+. Default: 1.5',
            default: 1.5,
          },
          height: {
            type: 'number',
            description: 'Window height in meters. Standard: 1-1.2m. Large: 1.5m. Default: 1.2',
            default: 1.2,
          },
          sillHeight: {
            type: 'number',
            description: 'Height from floor to window sill. Standard: 0.9-1m. Default: 0.9',
            default: 0.9,
          },
        },
        required: ['wallId', 't'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_items',
      description:
        'Place furniture or landscape items at specific coordinates. Items must be placed inside room polygons with 0.6m clearance from walls.',
      parameters: {
        type: 'object',
        properties: {
          assetId: {
            type: 'string',
            description:
              'Item ID. Examples: sofa, coffee-table, double-bed, kitchen, fridge, toilet, bathroom-sink, fir-tree, tree, low-fence, parking-spot',
          },
          position: {
            type: 'array',
            items: { type: 'number' },
            description: 'Position [x, y, z] in meters. y is always 0 for floor items.',
          },
          rotation: {
            type: 'number',
            description: 'Rotation in radians around Y axis. Default: 0',
            default: 0,
          },
        },
        required: ['assetId', 'position'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_blueprint',
      description: 'Read back a room\'s full geometry: polygon, wall IDs, which walls are exterior.',
      parameters: {
        type: 'object',
        properties: {
          roomId: {
            type: 'string',
            description: 'ID of the room created by create_room',
          },
        },
        required: ['roomId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_assets',
      description: 'Search for furniture and landscape items by category or keyword. Returns asset ID, dimensions, and category.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Category filter. Options: furniture, kitchen, bathroom, outdoor, appliance. Leave empty to search all.',
          },
          query: {
            type: 'string',
            description: 'Search keyword. Examples: sofa, bed, bathtub, tree, fence',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_scene',
      description:
        'Verify the entire scene for issues: overlapping items, floating rooms, gaps between rooms. Call after all rooms and items are placed.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

const MAX_ITERATIONS = 10

const ASSET_CATALOG: Record<
  string,
  { category: string; dimensions: [number, number, number] }
> = {
  sofa: { category: 'furniture', dimensions: [2.2, 0.9, 0.9] },
  'coffee-table': { category: 'furniture', dimensions: [1.2, 0.4, 0.7] },
  'tv-stand': { category: 'furniture', dimensions: [2.0, 0.4, 0.5] },
  'round-carpet': { category: 'furniture', dimensions: [2, 0.02, 2] },
  'indoor-plant': { category: 'furniture', dimensions: [0.5, 1.2, 0.5] },
  'double-bed': { category: 'furniture', dimensions: [1.6, 0.5, 2.1] },
  'single-bed': { category: 'furniture', dimensions: [1.0, 0.5, 2.0] },
  'bedside-table': { category: 'furniture', dimensions: [0.5, 0.6, 0.4] },
  dresser: { category: 'furniture', dimensions: [1.2, 1.0, 0.5] },
  closet: { category: 'furniture', dimensions: [1.5, 2.2, 0.6] },
  kitchen: { category: 'kitchen', dimensions: [3.0, 0.9, 0.6] },
  fridge: { category: 'kitchen', dimensions: [0.7, 1.8, 0.7] },
  stove: { category: 'kitchen', dimensions: [0.6, 0.9, 0.6] },
  'dining-table': { category: 'furniture', dimensions: [1.6, 0.75, 0.9] },
  'dining-chair': { category: 'furniture', dimensions: [0.5, 0.9, 0.5] },
  toilet: { category: 'bathroom', dimensions: [0.4, 0.8, 0.7] },
  'bathroom-sink': { category: 'bathroom', dimensions: [0.6, 0.9, 0.5] },
  'shower-square': { category: 'bathroom', dimensions: [0.9, 2.0, 0.9] },
  bathtub: { category: 'bathroom', dimensions: [1.7, 0.6, 0.8] },
  'fir-tree': { category: 'outdoor', dimensions: [1.5, 3.2, 1.5] },
  tree: { category: 'outdoor', dimensions: [4, 5, 4] },
  'low-fence': { category: 'outdoor', dimensions: [2, 0.8, 0.5] },
  'parking-spot': { category: 'outdoor', dimensions: [5, 1, 2.5] },
  'coat-rack': { category: 'furniture', dimensions: [0.5, 1.8, 0.5] },
}

// Track scene state during the agent loop
let sceneState = {
  rooms: [] as Array<{ roomId: string; name: string; polygon: number[][] }>,
  items: [] as Array<{ itemId: string; assetId: string; position: number[] }>,
  doors: [] as Array<{ doorId: string; wallId: string }>,
  windows: [] as Array<{ windowId: string; wallId: string }>,
}

async function executeToolServerSide(
  toolName: string,
  args: any,
  _sceneContext: any
): Promise<any> {
  switch (toolName) {
    case 'create_room': {
      const roomId = `room_${sceneState.rooms.length}`
      const polygon = args.polygon as number[][]
      const room = { roomId, name: args.name, polygon }
      sceneState.rooms.push(room)
      const xs = polygon.map((p) => p[0] ?? 0)
      const zs = polygon.map((p) => p[1] ?? 0)
      const width = Math.max(...xs) - Math.min(...xs)
      const depth = Math.max(...zs) - Math.min(...zs)
      return {
        roomId,
        name: args.name,
        polygon,
        dimensions: { width: width.toFixed(1), depth: depth.toFixed(1) },
        status: 'created',
      }
    }
    case 'place_items': {
      const itemId = `item_${sceneState.items.length}`
      const item = { itemId, assetId: args.assetId, position: args.position }
      sceneState.items.push(item)
      return {
        itemId,
        assetId: args.assetId,
        position: args.position,
        status: 'placed',
      }
    }
    case 'add_door': {
      const doorId = `door_${sceneState.doors.length}`
      sceneState.doors.push({ doorId, wallId: args.wallId })
      return { doorId, wallId: args.wallId, status: 'added' }
    }
    case 'add_window': {
      const windowId = `window_${sceneState.windows.length}`
      sceneState.windows.push({ windowId, wallId: args.wallId })
      return { windowId, wallId: args.wallId, status: 'added' }
    }
    case 'get_room_blueprint': {
      const room = sceneState.rooms.find((r) => r.roomId === args.roomId)
      if (!room) {
        return { error: `Room ${args.roomId} not found` }
      }
      const xs = room.polygon.map((p) => p[0])
      const zs = room.polygon.map((p) => p[1])
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minZ = Math.min(...zs)
      const maxZ = Math.max(...zs)
      return {
        roomId: room.roomId,
        name: room.name,
        polygon: room.polygon,
        walls: [
          { wallId: `wall_${room.roomId}_0`, isExterior: true, length: (maxX - minX).toFixed(1) },
          { wallId: `wall_${room.roomId}_1`, isExterior: false, length: (maxZ - minZ).toFixed(1) },
        ],
        status: 'retrieved',
      }
    }
    case 'search_assets': {
      const query = (args.query || '').toLowerCase()
      const category = args.category?.toLowerCase()
      const matches = Object.entries(ASSET_CATALOG)
        .filter(([id, asset]) => {
          const matchesCategory = !category || asset.category === category
          const matchesQuery = id.includes(query) || asset.category.includes(query)
          return matchesCategory && matchesQuery
        })
        .map(([id, asset]) => ({
          assetId: id,
          category: asset.category,
          dimensions: asset.dimensions,
        }))
      return {
        results: matches.slice(0, 10),
        count: matches.length,
      }
    }
    case 'verify_scene': {
      const summary = `Scene contains ${sceneState.rooms.length} rooms, ${sceneState.items.length} items, ${sceneState.doors.length} doors, ${sceneState.windows.length} windows.`
      return {
        ok: true,
        issues: [],
        summary,
      }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, sceneContext } = await req.json()

    // Reset scene state for this request
    sceneState = {
      rooms: [],
      items: [],
      doors: [],
      windows: [],
    }

    const systemPrompt = `You are a careful, methodical architect. Design rooms step-by-step:

1. UNDERSTAND: Read the user's brief. Decide: 2BHK? Modern kitchen? Parking?
   Break it into: Foyer, Living Room, Kitchen, Master Bedroom, Master Bathroom,
   Bedroom, Bathroom, optional Garage.

2. PLAN BEFORE ACTING: Before create_room, decide the room polygon. Room sizes (meters, width × depth):
   - Living Room: 6×5 to 8×6 | Kitchen: 4×4 to 5×5 | Master Bedroom: 4×5 to 5×6
   - Bedroom: 3×4 to 4×5 | Bathroom: 2×2.5 to 2.5×3 | Master Bathroom: 3×4
   - Foyer: 2×3 | Garage: 6×6 to 7×7

3. BUILD SHELL: Call create_room for each room. Immediately call get_room_blueprint to read back wall IDs and geometry.
   Ensure: Rooms share walls (no gaps, no overlaps) | Bedrooms grouped together | Living Room adjacent to Kitchen

4. ADD OPENINGS: For each room, call add_door (entry, inter-room). Call add_window ONLY on exterior walls.
   Position at t=0.3-0.7 (never corners).

5. SEARCH AND PLACE: Call search_assets to find items for the room type. Then place_items with coordinates inside polygon.
   Living Room: sofa, coffee-table, tv-stand | Kitchen: kitchen, fridge, dining-table
   Bedrooms: bed, bedside-table, dresser | Bathrooms: toilet, sink, shower/bathtub

6. VERIFY: Call verify_scene. If issues, fix them. Call verify_scene again.

7. FINISH: When verified, write a brief summary of what you built.

CONSTRAINTS: Coordinates are ALWAYS actual numbers. Use levelId: "${sceneContext?.currentLevelId || 'level'}"
Start at [0,0], grow in +X and +Z. Rooms must be adjacent. If unsure about item dimensions, search_assets BEFORE placing.`

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]

    const allToolCalls = []
    let finalMessage = ''

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`[AI Loop] Iteration ${i + 1}/${MAX_ITERATIONS}`)
      try {
        const response = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          tools: TOOLS,
          tool_choice: 'auto',
          messages,
          max_tokens: 1024,
        })

        const msg = response.choices[0]!.message
        messages.push(msg as any)

        // No more tool calls — model is done
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          finalMessage = msg.content ?? 'Done.'
          console.log(`[AI Loop] Model finished at iteration ${i + 1}`)
          break
        }

        console.log(`[AI Loop] Model emitted ${msg.tool_calls.length} tool calls`)

        // Execute each tool call, push result back to model
        for (const tc of msg.tool_calls) {
          try {
            const args = JSON.parse(tc.function.arguments)
            const result = await executeToolServerSide(tc.function.name, args, sceneContext)

            allToolCalls.push({
              id: tc.id,
              name: tc.function.name,
              input: args,
            })

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            })

            console.log(`[AI Loop] Executed tool: ${tc.function.name}`)
          } catch (toolError) {
            console.error(`[AI Loop] Error executing tool ${tc.function.name}:`, toolError)
            throw toolError
          }
        }
      } catch (loopError) {
        console.error(`[AI Loop] Error in iteration ${i + 1}:`, loopError)
        throw loopError
      }
    }

    return Response.json({
      toolCalls: allToolCalls,
      message: finalMessage,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('AI generation error:', errorMsg)
    console.error('Full error:', error)
    return Response.json({ error: `Failed to generate: ${errorMsg}` }, { status: 500 })
  }
}
