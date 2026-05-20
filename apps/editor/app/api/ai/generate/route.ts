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
]

export async function POST(req: Request) {
  try {
    const { prompt, sceneContext } = await req.json()

    const systemPrompt = `You are an architect designing elegant homes. Create rooms ONLY using create_room tool. All coordinates must be ACTUAL NUMBERS.

ROOM SIZES (meters, width × depth):
Living Room: 6×5 to 8×6 | Kitchen: 4×4 to 5×5 | Master Bedroom: 4×5 to 5×6
Bedroom: 3×4 to 4×5 | Bathroom: 2×2.5 to 2.5×3 | Master Bathroom: 3×4
Hallway/Foyer: 2×3 | Garage: 6×6 to 7×7

ADJACENCY RULES (rooms must be logical neighbors):
- Living Room ↔ Kitchen (shared wall or open plan)
- Master Bedroom ↔ Master Bathroom (en-suite, private access)
- Living Room ↔ Entrance/Foyer (entry point)
- All bedrooms grouped together, away from kitchen and garage
- Garage separate, accessible from entrance only
- Bathrooms private, never opening into kitchen

LAYOUT RULES:
- Start at origin [0,0], expand in +X (right) and +Z (forward)
- All rooms share walls (no gaps between rooms, no overlaps)
- Each room polygon: 4 corners in clockwise order, e.g. [[0,0],[4,0],[4,6],[0,6]]
- Use levelId: "${sceneContext?.currentLevelId || 'level'}"

For 2BHK generate: Foyer, Living Room, Kitchen, Master Bedroom, Master Bathroom, Bedroom, Bathroom, optional Garage
For 3BHK add: 2nd Bedroom and shared Bathroom
Rooms must be adjacent - no floating/isolated rooms.`

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1024,
      tools: TOOLS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    })

    // Extract tool calls from response
    const toolCalls = response.choices[0]?.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    })) || []

    // Extract text response
    const textContent = response.choices[0]?.message.content || 'Creating your house layout...'

    return Response.json({
      toolCalls,
      message: textContent,
    })
  } catch (error) {
    console.error('AI generation error:', error)
    return Response.json({ error: 'Failed to generate' }, { status: 500 })
  }
}
