import Groq from 'groq-sdk'

let groqInstance: Groq | null = null

function getGroq(): Groq {
  if (!groqInstance) {
    groqInstance = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  }
  return groqInstance
}

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
  {
    type: 'function',
    function: {
      name: 'delete_room',
      description:
        'Delete a room and all its doors/windows to fix layout issues. Use when verify_scene detects overlapping or misaligned rooms.',
      parameters: {
        type: 'object',
        properties: {
          roomId: {
            type: 'string',
            description: 'ID of the room to delete (e.g., room_0, room_1)',
          },
        },
        required: ['roomId'],
      },
    },
  },
]

const MAX_ITERATIONS = 4

// Room specifications by type
const ROOM_SPECS: Record<string, { width: number; depth: number; furniture: string[] }> = {
  'living-room': { width: 6, depth: 5, furniture: ['sofa', 'coffee-table', 'tv-stand', 'round-carpet'] },
  'kitchen': { width: 4, depth: 3.5, furniture: ['kitchen', 'fridge', 'stove'] },
  'bedroom': { width: 4, depth: 3.5, furniture: ['double-bed', 'bedside-table', 'dresser'] },
  'small-bedroom': { width: 3, depth: 3, furniture: ['single-bed', 'bedside-table'] },
  'bathroom': { width: 2.5, depth: 2, furniture: ['toilet', 'bathroom-sink', 'shower-square'] },
  'hallway': { width: 2, depth: 3, furniture: [] },
  'foyer': { width: 2.5, depth: 3, furniture: [] },
}

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

// Geometry helpers for collision detection
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, z] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (!pi || !pj) continue
    const xi = pi[0] ?? 0
    const zi = pi[1] ?? 0
    const xj = pj[0] ?? 0
    const zj = pj[1] ?? 0
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function polygonsOverlap(poly1: number[][], poly2: number[][]): boolean {
  for (const vertex of poly1) {
    const [x = 0, z = 0] = vertex
    if (pointInPolygon([x, z], poly2)) return true
  }
  for (const vertex of poly2) {
    const [x = 0, z = 0] = vertex
    if (pointInPolygon([x, z], poly1)) return true
  }
  return false
}

async function executeToolServerSide(
  toolName: string,
  args: any,
  _sceneContext: any
): Promise<any> {
  switch (toolName) {
    case 'create_room': {
      const roomId = `room_${sceneState.rooms.length}`
      let polygon = args.polygon as number[][]
      // Handle LLM sometimes stringifying the polygon
      if (typeof polygon === 'string') {
        try {
          polygon = JSON.parse(polygon)
        } catch {
          return { error: `Invalid polygon format: ${polygon}` }
        }
      }
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
      const issues: string[] = []

      // Check for overlapping rooms
      for (let i = 0; i < sceneState.rooms.length; i++) {
        for (let j = i + 1; j < sceneState.rooms.length; j++) {
          const room1 = sceneState.rooms[i]
          const room2 = sceneState.rooms[j]
          if (room1 && room2 && polygonsOverlap(room1.polygon, room2.polygon)) {
            issues.push(
              `Rooms overlap: "${room1.name}" (${room1.roomId}) and "${room2.name}" (${room2.roomId})`
            )
          }
        }
      }

      // Check for items outside room bounds
      for (const item of sceneState.items) {
        const pos = item.position
        let inRoom = false
        for (const room of sceneState.rooms) {
          if (room && pointInPolygon([pos[0] ?? 0, pos[2] ?? 0], room.polygon)) {
            inRoom = true
            break
          }
        }
        if (!inRoom) {
          issues.push(`Item "${item.assetId}" (${item.itemId}) is outside all rooms at position [${pos}]`)
        }
      }

      const ok = issues.length === 0
      const summary = `Scene contains ${sceneState.rooms.length} rooms, ${sceneState.items.length} items, ${sceneState.doors.length} doors, ${sceneState.windows.length} windows.${ok ? ' All checks passed.' : ` ${issues.length} issues found.`}`
      return { ok, issues, summary }
    }
    case 'delete_room': {
      const roomId = args.roomId as string
      const roomIndex = sceneState.rooms.findIndex((r) => r.roomId === roomId)
      if (roomIndex === -1) {
        return { error: `Room ${roomId} not found` }
      }
      const room = sceneState.rooms[roomIndex]
      if (!room) {
        return { error: `Room ${roomId} not found` }
      }
      sceneState.rooms.splice(roomIndex, 1)
      sceneState.doors = sceneState.doors.filter((d) => !d.wallId.includes(roomId))
      sceneState.windows = sceneState.windows.filter((w) => !w.wallId.includes(roomId))
      return { status: 'deleted', roomId, name: room.name }
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

    const systemPrompt = `INTELLIGENT HOUSE DESIGN:
1. ANALYZE: Understand house type (1BHK, 2BHK, 3BHK, villa, etc.) and requirements from user input.
2. PLAN: Design room layout with calculated positions:
   - LR 6×5: [0,0] to [6,5], doors to Kitchen/Hall, 2 windows
   - Kitchen 4×3.5: adjacent to LR, 1 door, 1 window
   - Master Bed 4×3.5: double-bed, 1 door, 1 window
   - Bedroom 3×3: single-bed, 1 door, 1 window (skip if 1BHK)
   - Bathroom 2.5×2: toilet+sink+shower, 1 door, NO windows
   - Hallway/Foyer: connect rooms
   ARRANGE: Position rooms to avoid overlaps. Use grid-aligned coordinates.
3. BUILD: For each room in order:
   a) create_room with polygon (clockwise: [x,z] vertices)
   b) get_room_blueprint → extract wallIds
   c) add_door on INTERIOR walls (t=0.5, 0.9m width)
   d) add_window on EXTERIOR walls ONLY (t=0.5, 1.5m width)
   e) search_assets for room-specific furniture
   f) place_items at ROOM CENTER with 1.2m clearance from walls (items must be well inside)
4. VERIFY: verify_scene. If overlaps/gaps: delete_room, recalculate positions, rebuild.
5. FURNITURE MAPPING: LR→sofa+coffee-table, K→kitchen+fridge, Bed→bed+table, Bath→toilet+sink.
LevelId: "${sceneContext?.currentLevelId || 'level'}" | All polygons as arrays [[x,z],...] NOT strings.`

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]

    const allToolCalls = []
    let finalMessage = ''

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(`[AI Loop] Iteration ${i + 1}/${MAX_ITERATIONS}`)
      try {
        const response = await getGroq().chat.completions.create({
          model: 'llama-3.1-8b-instant',
          tools: TOOLS,
          tool_choice: 'auto',
          messages,
          max_tokens: 256,
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
