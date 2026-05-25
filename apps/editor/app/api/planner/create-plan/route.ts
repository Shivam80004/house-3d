import Groq from 'groq-sdk'

const systemPrompt = `You are an expert architect creating house plans. Generate an optimized house plan based on user requirements.

Output ONLY valid JSON (no markdown, no extra text) following this exact structure:
{
  "summary": "Brief description of the house",
  "rooms": [
    {
      "id": "room_lr",
      "name": "Living Room",
      "type": "living-room",
      "dimensions": { "width": 6, "depth": 5 },
      "polygon": [[0,0], [6,0], [6,5], [0,5]],
      "wallHeight": 2.7,
      "windows": 2,
      "doors": [{ "to": "Hallway", "position": 0.5 }]
    }
  ],
  "layout": {
    "gridSize": 10,
    "totalArea": 120,
    "roomArrangement": "Description of how rooms are arranged",
    "notes": "Any special design notes"
  },
  "furniture": {
    "living-room": ["sofa", "coffee-table", "tv-stand", "round-carpet"],
    "kitchen": ["kitchen", "fridge", "dining-table", "dining-chair"],
    "bedroom": ["double-bed", "bedside-table", "dresser"]
  },
  "outdoor": ["parking-spot", "low-fence", "tree"]
}

CONSTRAINTS:
- Rooms must be contiguous with shared walls (no gaps)
- Use rectangular polygon coordinates [x, z]
- Standard sizes: LR 6×5, Kitchen 4×3.5, Bedroom 4×3, Bathroom 2.5×2, Hallway 2×3
- Start first room at [0,0], grow in +X and +Z directions
- Position subsequent rooms adjacent to previous ones (sharing walls)
- Bedrooms and bathrooms on one side, living/kitchen on other
- Hallway connects all rooms
- For 2BHK: foyer, living room, kitchen, 2 bedrooms, 2 bathrooms, hallway
- For 3BHK: add extra bedroom + bathroom to 2BHK layout
- Add garage if user requests (6×6, positioned separately)
- Assign 2 windows to large rooms, 0-1 to small rooms
- Windows only on exterior walls
- Doors connect adjacent rooms`

let groqInstance: Groq | null = null

function getGroq() {
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqInstance
}

export async function POST(request: Request) {
  try {
    const {
      houseType,
      roomCount,
      areaPreference,
      preferences,
    } = await request.json()

    const groq = getGroq()

    const userPrompt = `Generate a house plan with these requirements:
- Type: ${houseType}
- Total Rooms: ${roomCount}
- Area Size: ${areaPreference}
- Additional Preferences: ${preferences || 'None'}

Create an optimized layout with logical room arrangement, proper dimensions, and realistic furniture placement.`

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    })

    const content = response.choices[0]?.message.content || ''

    // Parse JSON from response (may have markdown formatting)
    let jsonStr = content
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1]?.split('```')[0] || content
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1]?.split('```')[0] || content
    }

    const plan = JSON.parse(jsonStr.trim())

    return Response.json({ plan, summary: plan.summary })
  } catch (error) {
    console.error('Planner error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status: 500 }
    )
  }
}
