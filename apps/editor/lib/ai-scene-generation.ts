import {
  CeilingNode,
  SlabNode,
  WallNode,
  WindowNode,
  RoofNode,
  RoofSegmentNode,
  type AnyNodeId,
  useScene,
} from '@pascal-app/core'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

interface RoomInfo {
  name: string
  polygon: Array<[number, number]>
  wallHeight: number
  walls: WallNode[]
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  levelId: string
): Promise<AnyNodeId[]> {
  const { createNodes } = useScene.getState()
  const createdIds: AnyNodeId[] = []
  const rooms: RoomInfo[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = []

  // First pass: create rooms and track info
  for (const call of toolCalls) {
    if (call.name === 'create_room') {
      const { polygon, name, wallHeight = 2.7 } = call.input as {
        polygon: Array<[number, number]>
        name: string
        wallHeight?: number
      }

      if (!polygon || polygon.length < 3) continue

      // Track room bounds for exterior detection
      const xs = polygon.map(([x]) => x)
      const zs = polygon.map(([, z]) => z)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minZ = Math.min(...zs)
      const maxZ = Math.max(...zs)

      // Create walls
      const walls: WallNode[] = []
      for (let i = 0; i < polygon.length; i++) {
        const start = polygon[i]!
        const end = polygon[(i + 1) % polygon.length]!

        const wall = WallNode.parse({
          start: [start[0], start[1]],
          end: [end[0], end[1]],
        })
        walls.push(wall)
        ops.push({ node: wall, parentId: levelId })
        createdIds.push(wall.id)
      }

      // Create floor slab
      const slab = SlabNode.parse({
        polygon: polygon.map(([x, z]) => [x, z]),
      })
      ops.push({ node: slab, parentId: levelId })
      createdIds.push(slab.id)

      // Create ceiling
      const ceiling = CeilingNode.parse({
        polygon: polygon.map(([x, z]) => [x, z]),
        height: wallHeight,
      })
      ops.push({ node: ceiling, parentId: levelId })
      createdIds.push(ceiling.id)

      rooms.push({ name, polygon, wallHeight, walls, minX, maxX, minZ, maxZ })
    }
  }

  // Add windows to exterior walls
  for (const room of rooms) {
    for (let i = 0; i < room.walls.length; i++) {
      const wall = room.walls[i]!
      const start = room.polygon[i]!
      const isExterior =
        start[0] === room.minX ||
        start[0] === room.maxX ||
        start[1] === room.minZ ||
        start[1] === room.maxZ

      if (isExterior && !room.name.includes('Bathroom') && !room.name.includes('Hallway')) {
        const window = WindowNode.parse({
          position: [0.5, 1.0, 0],
          rotation: [0, 0, 0],
          side: 'front',
          wallId: wall.id,
          width: 1.5,
          height: 1.2,
          windowType: 'fixed',
        })
        ops.push({ node: window, parentId: wall.id })
        createdIds.push(window.id)
      }
    }
  }

  // Generate roof covering all rooms
  if (rooms.length > 0) {
    const allXs = rooms.flatMap((r) => r.polygon.map(([x]) => x))
    const allZs = rooms.flatMap((r) => r.polygon.map(([, z]) => z))
    const roofMinX = Math.min(...allXs)
    const roofMaxX = Math.max(...allXs)
    const roofMinZ = Math.min(...allZs)
    const roofMaxZ = Math.max(...allZs)

    const roofWidth = roofMaxX - roofMinX
    const roofDepth = roofMaxZ - roofMinZ
    const avgWallHeight = rooms[0]!.wallHeight || 2.7

    const roofSegment = RoofSegmentNode.parse({
      position: [0, 0, 0],
      roofType: 'gable',
      width: roofWidth,
      depth: roofDepth,
      wallHeight: 0.3,
      roofHeight: 1.5,
      overhang: 0.3,
    })

    const roof = RoofNode.parse({
      position: [roofMinX + roofWidth / 2, avgWallHeight, roofMinZ + roofDepth / 2],
      children: [roofSegment.id],
    })

    ops.push({ node: roof, parentId: levelId })
    ops.push({ node: roofSegment, parentId: roof.id })
    createdIds.push(roof.id)
    createdIds.push(roofSegment.id)
  }

  // Execute all operations at once
  if (ops.length > 0) {
    createNodes(ops)
  }

  return createdIds
}
