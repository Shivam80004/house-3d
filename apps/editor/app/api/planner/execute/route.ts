interface HousePlan {
  summary: string
  rooms: Array<{
    id: string
    name: string
    type: string
    dimensions: { width: number; depth: number }
    polygon: Array<[number, number]>
    wallHeight?: number
    windows?: number
    doors?: Array<{ to: string; position: number }>
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

interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

function calculateRoomCenter(polygon: Array<[number, number]>): [number, number] {
  let sumX = 0
  let sumZ = 0
  for (const [x, z] of polygon) {
    sumX += x
    sumZ += z
  }
  return [sumX / polygon.length, sumZ / polygon.length]
}

function getRoomByType(rooms: HousePlan['rooms'], roomType: string): HousePlan['rooms'][0] | undefined {
  return rooms.find((r) => r.type === roomType || r.name.toLowerCase().includes(roomType.toLowerCase()))
}

export async function POST(request: Request) {
  try {
    const { plan, levelId } = await request.json() as {
      plan: HousePlan
      levelId: string
    }

    if (!plan || !levelId) {
      return Response.json({ error: 'Missing plan or levelId' }, { status: 400 })
    }

    // Convert plan to tool calls
    const toolCalls: ToolCall[] = []
    let callId = 0

    // Step 1: Create all rooms
    for (const room of plan.rooms) {
      toolCalls.push({
        id: `${callId++}`,
        name: 'create_room',
        input: {
          name: room.name,
          polygon: room.polygon,
          wallHeight: room.wallHeight ?? 2.7,
        },
      })
    }

    // Step 2: Add doors from room connections
    let entryAdded = false
    for (const room of plan.rooms) {
      if (room.doors && room.doors.length > 0) {
        for (const door of room.doors) {
          toolCalls.push({
            id: `${callId++}`,
            name: 'add_door',
            input: {
              roomId: room.id,
              t: door.position ?? 0.5,
              width: 0.9,
              height: 2.1,
            },
          })
          entryAdded = true
        }
      }
    }

    // Add entry door to first room if none specified
    if (!entryAdded && plan.rooms.length > 0) {
      const firstRoom = plan.rooms[0]
      toolCalls.push({
        id: `${callId++}`,
        name: 'add_door',
        input: {
          roomId: firstRoom.id,
          t: 0.5,
          width: 0.9,
          height: 2.1,
        },
      })
    }

    // Step 3: Place furniture in appropriate rooms
    for (const [roomType, items] of Object.entries(plan.furniture || {})) {
      if (!items || items.length === 0) continue

      const targetRoom = getRoomByType(plan.rooms, roomType)
      if (!targetRoom) continue

      // Calculate room center for furniture placement
      const [centerX, centerZ] = calculateRoomCenter(targetRoom.polygon)

      // Calculate room bounds for clearance
      const xs = targetRoom.polygon.map(([x]) => x)
      const zs = targetRoom.polygon.map(([, z]) => z)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minZ = Math.min(...zs)
      const maxZ = Math.max(...zs)

      const CLEARANCE = 1.2
      const usableMinX = minX + CLEARANCE
      const usableMaxX = maxX - CLEARANCE
      const usableMinZ = minZ + CLEARANCE
      const usableMaxZ = maxZ - CLEARANCE

      // Place items with distribution inside room
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Distribute items around room center
        const angle = (i / Math.max(items.length, 1)) * Math.PI * 2
        const radius = Math.min((usableMaxX - usableMinX) / 4, (usableMaxZ - usableMinZ) / 4)
        const offsetX = Math.cos(angle) * radius * 0.7
        const offsetZ = Math.sin(angle) * radius * 0.7

        let x = centerX + offsetX
        let z = centerZ + offsetZ

        // Clamp to usable bounds
        x = Math.max(usableMinX, Math.min(x, usableMaxX))
        z = Math.max(usableMinZ, Math.min(z, usableMaxZ))

        toolCalls.push({
          id: `${callId++}`,
          name: 'place_items',
          input: {
            assetId: item,
            position: [x, 0, z],
            rotation: 0,
          },
        })
      }
    }

    // Step 4: Add outdoor elements
    if (plan.outdoor && plan.outdoor.length > 0) {
      // Place outdoor items around the house perimeter
      const allXs = plan.rooms.flatMap((r) => r.polygon.map(([x]) => x))
      const allZs = plan.rooms.flatMap((r) => r.polygon.map(([, z]) => z))
      const houseMinX = Math.min(...allXs)
      const houseMaxX = Math.max(...allXs)
      const houseMinZ = Math.min(...allZs)
      const houseMaxZ = Math.max(...allZs)

      for (let i = 0; i < plan.outdoor.length; i++) {
        const item = plan.outdoor[i]
        const angle = (i / Math.max(plan.outdoor.length, 1)) * Math.PI * 2
        const distance = Math.max(houseMaxX - houseMinX, houseMaxZ - houseMinZ) / 2 + 3

        const centerX = (houseMinX + houseMaxX) / 2
        const centerZ = (houseMinZ + houseMaxZ) / 2
        const x = centerX + Math.cos(angle) * distance
        const z = centerZ + Math.sin(angle) * distance

        toolCalls.push({
          id: `${callId++}`,
          name: 'place_items',
          input: {
            assetId: item,
            position: [x, 0, z],
            rotation: 0,
          },
        })
      }
    }

    // Return tool calls to client for execution
    return Response.json({
      toolCalls,
      message: `Plan converted to ${toolCalls.length} scene operations`,
      count: toolCalls.length,
    })
  } catch (error) {
    console.error('Planner execution error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to execute plan' },
      { status: 500 }
    )
  }
}
