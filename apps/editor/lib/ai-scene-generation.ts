import {
  CeilingNode,
  ItemNode,
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

const ASSET_CATALOG: Record<
  string,
  {
    category: string
    thumbnail: string
    src: string
    dimensions: [number, number, number]
    offset?: [number, number, number]
  }
> = {
  sofa: {
    category: 'furniture',
    thumbnail: '/items/sofa/thumbnail.webp',
    src: '/items/sofa/model.glb',
    dimensions: [2.2, 0.9, 0.9],
  },
  'coffee-table': {
    category: 'furniture',
    thumbnail: '/items/coffee-table/thumbnail.webp',
    src: '/items/coffee-table/model.glb',
    dimensions: [1.2, 0.4, 0.7],
  },
  'tv-stand': {
    category: 'furniture',
    thumbnail: '/items/tv-stand/thumbnail.webp',
    src: '/items/tv-stand/model.glb',
    dimensions: [2.0, 0.4, 0.5],
    offset: [0, 0.21, 0],
  },
  'round-carpet': {
    category: 'furniture',
    thumbnail: '/items/round-carpet/thumbnail.webp',
    src: '/items/round-carpet/model.glb',
    dimensions: [2, 0.02, 2],
  },
  'indoor-plant': {
    category: 'furniture',
    thumbnail: '/items/indoor-plant/thumbnail.webp',
    src: '/items/indoor-plant/model.glb',
    dimensions: [0.5, 1.2, 0.5],
  },
  'double-bed': {
    category: 'furniture',
    thumbnail: '/items/double-bed/thumbnail.webp',
    src: '/items/double-bed/model.glb',
    dimensions: [1.6, 0.5, 2.1],
  },
  'single-bed': {
    category: 'furniture',
    thumbnail: '/items/single-bed/thumbnail.webp',
    src: '/items/single-bed/model.glb',
    dimensions: [1.0, 0.5, 2.0],
  },
  'bedside-table': {
    category: 'furniture',
    thumbnail: '/items/bedside-table/thumbnail.webp',
    src: '/items/bedside-table/model.glb',
    dimensions: [0.5, 0.6, 0.4],
  },
  dresser: {
    category: 'furniture',
    thumbnail: '/items/dresser/thumbnail.webp',
    src: '/items/dresser/model.glb',
    dimensions: [1.2, 1.0, 0.5],
  },
  closet: {
    category: 'furniture',
    thumbnail: '/items/closet/thumbnail.webp',
    src: '/items/closet/model.glb',
    dimensions: [1.5, 2.2, 0.6],
  },
  kitchen: {
    category: 'kitchen',
    thumbnail: '/items/kitchen/thumbnail.webp',
    src: '/items/kitchen/model.glb',
    dimensions: [3.0, 0.9, 0.6],
  },
  fridge: {
    category: 'kitchen',
    thumbnail: '/items/fridge/thumbnail.webp',
    src: '/items/fridge/model.glb',
    dimensions: [0.7, 1.8, 0.7],
  },
  'dining-table': {
    category: 'furniture',
    thumbnail: '/items/dining-table/thumbnail.webp',
    src: '/items/dining-table/model.glb',
    dimensions: [1.6, 0.75, 0.9],
  },
  'dining-chair': {
    category: 'furniture',
    thumbnail: '/items/dining-chair/thumbnail.webp',
    src: '/items/dining-chair/model.glb',
    dimensions: [0.5, 0.9, 0.5],
  },
  toilet: {
    category: 'bathroom',
    thumbnail: '/items/toilet/thumbnail.webp',
    src: '/items/toilet/model.glb',
    dimensions: [0.4, 0.8, 0.7],
  },
  'bathroom-sink': {
    category: 'bathroom',
    thumbnail: '/items/bathroom-sink/thumbnail.webp',
    src: '/items/bathroom-sink/model.glb',
    dimensions: [0.6, 0.9, 0.5],
  },
  'shower-square': {
    category: 'bathroom',
    thumbnail: '/items/shower-square/thumbnail.webp',
    src: '/items/shower-square/model.glb',
    dimensions: [0.9, 2.0, 0.9],
  },
  bathtub: {
    category: 'bathroom',
    thumbnail: '/items/bathtub/thumbnail.webp',
    src: '/items/bathtub/model.glb',
    dimensions: [1.7, 0.6, 0.8],
  },
  'fir-tree': {
    category: 'outdoor',
    thumbnail: '/items/fir-tree/thumbnail.webp',
    src: '/items/fir-tree/model.glb',
    dimensions: [1.5, 3.2, 1.5],
    offset: [-0.09, 0.05, 0.03],
  },
  tree: {
    category: 'outdoor',
    thumbnail: '/items/tree/thumbnail.webp',
    src: '/items/tree/model.glb',
    dimensions: [4, 5, 4],
    offset: [0.09, 0.17, 0.06],
  },
  'low-fence': {
    category: 'outdoor',
    thumbnail: '/items/low-fence/thumbnail.webp',
    src: '/items/low-fence/model.glb',
    dimensions: [2, 0.8, 0.5],
    offset: [0, 0.01, 0],
  },
  'parking-spot': {
    category: 'outdoor',
    thumbnail: '/items/parking-spot/thumbnail.webp',
    src: '/items/parking-spot/model.glb',
    dimensions: [5, 1, 2.5],
    offset: [0, 0, 0.01],
  },
  'coat-rack': {
    category: 'furniture',
    thumbnail: '/items/coat-rack/thumbnail.webp',
    src: '/items/coat-rack/model.glb',
    dimensions: [0.5, 1.8, 0.5],
  },
}

const ROOM_FURNITURE: Record<string, Array<{ assetId: string; offsetX: number; offsetZ: number; rotY?: number }>> = {
  'living room': [
    { assetId: 'sofa', offsetX: 0.5, offsetZ: 0.5 },
    { assetId: 'coffee-table', offsetX: 0.5, offsetZ: 1.5 },
    { assetId: 'tv-stand', offsetX: 0.5, offsetZ: -0.5, rotY: Math.PI },
    { assetId: 'round-carpet', offsetX: 0.5, offsetZ: 1.0 },
    { assetId: 'indoor-plant', offsetX: -0.3, offsetZ: 0.3 },
  ],
  kitchen: [
    { assetId: 'kitchen', offsetX: 0.5, offsetZ: 0.3 },
    { assetId: 'fridge', offsetX: -0.3, offsetZ: 0.3 },
    { assetId: 'dining-table', offsetX: 0.5, offsetZ: 2.0 },
    { assetId: 'dining-chair', offsetX: 0.0, offsetZ: 2.0, rotY: 0 },
    { assetId: 'dining-chair', offsetX: 1.0, offsetZ: 2.0, rotY: Math.PI },
  ],
  'master bedroom': [
    { assetId: 'double-bed', offsetX: 0.5, offsetZ: 0.5 },
    { assetId: 'bedside-table', offsetX: -0.1, offsetZ: 0.5 },
    { assetId: 'bedside-table', offsetX: 1.2, offsetZ: 0.5 },
    { assetId: 'dresser', offsetX: 0.5, offsetZ: 2.5 },
    { assetId: 'closet', offsetX: -0.3, offsetZ: 1.5 },
  ],
  bedroom: [
    { assetId: 'single-bed', offsetX: 0.5, offsetZ: 0.5 },
    { assetId: 'bedside-table', offsetX: 1.2, offsetZ: 0.5 },
    { assetId: 'closet', offsetX: -0.3, offsetZ: 1.5 },
    { assetId: 'dresser', offsetX: 0.5, offsetZ: 2.5 },
  ],
  'master bathroom': [
    { assetId: 'bathtub', offsetX: 0.3, offsetZ: 0.5 },
    { assetId: 'toilet', offsetX: 1.5, offsetZ: 0.3 },
    { assetId: 'bathroom-sink', offsetX: 0.3, offsetZ: 1.5 },
  ],
  bathroom: [
    { assetId: 'shower-square', offsetX: 0.3, offsetZ: 0.3 },
    { assetId: 'toilet', offsetX: 1.2, offsetZ: 0.3 },
    { assetId: 'bathroom-sink', offsetX: 0.3, offsetZ: 1.5 },
  ],
  foyer: [
    { assetId: 'coat-rack', offsetX: 0.3, offsetZ: 0.3 },
    { assetId: 'indoor-plant', offsetX: -0.3, offsetZ: 0.3 },
  ],
  entrance: [{ assetId: 'coat-rack', offsetX: 0.3, offsetZ: 0.3 }],
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

function addItem(assetId: string, position: [number, number, number], rotY: number, ops: any[], levelId: string): void {
  const assetMeta = ASSET_CATALOG[assetId]
  if (!assetMeta) return
  try {
    const item = ItemNode.parse({
      position,
      rotation: [0, rotY, 0],
      asset: {
        id: assetId,
        name: assetId,
        category: assetMeta.category,
        thumbnail: assetMeta.thumbnail,
        src: assetMeta.src,
        dimensions: assetMeta.dimensions,
        offset: assetMeta.offset ?? [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    })
    ops.push({ node: item, parentId: levelId })
  } catch {
    // Skip invalid items
  }
}

function addFurnitureToRoom(room: RoomInfo, ops: any[], levelId: string): void {
  const key = room.name.toLowerCase()
  const items = ROOM_FURNITURE[key] ?? []
  const centerX = (room.minX + room.maxX) / 2
  const centerZ = (room.minZ + room.maxZ) / 2

  for (const spec of items) {
    addItem(spec.assetId, [centerX + spec.offsetX, 0, centerZ + spec.offsetZ], spec.rotY ?? 0, ops, levelId)
  }
}

function addOutdoorLandscaping(rooms: RoomInfo[], ops: any[], levelId: string): void {
  if (rooms.length === 0) return
  const allXs = rooms.flatMap((r) => r.polygon.map(([x]) => x))
  const allZs = rooms.flatMap((r) => r.polygon.map(([, z]) => z))
  const minX = Math.min(...allXs) - 3
  const maxX = Math.max(...allXs) + 3
  const minZ = Math.min(...allZs) - 3
  const maxZ = Math.max(...allZs) + 3

  // Fir trees along front edge
  for (let x = minX; x <= maxX; x += 3) {
    addItem('fir-tree', [x, 0, maxZ + 2], 0, ops, levelId)
  }
  // Large trees at corners
  addItem('tree', [minX + 2, 0, minZ - 2], 0, ops, levelId)
  addItem('tree', [maxX - 2, 0, minZ - 2], 0, ops, levelId)
  // Parking spot near garage room if exists
  const garage = rooms.find((r) => r.name.toLowerCase().includes('garage') || r.name.toLowerCase().includes('parking'))
  if (garage) {
    const gCX = (garage.minX + garage.maxX) / 2
    const gCZ = garage.maxZ + 2
    addItem('parking-spot', [gCX, 0, gCZ], 0, ops, levelId)
  }
  // Low fence row at front
  for (let x = minX; x <= maxX; x += 2) {
    addItem('low-fence', [x, 0, maxZ + 3.5], 0, ops, levelId)
  }
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

  // Add furniture to each room
  for (const room of rooms) {
    addFurnitureToRoom(room, ops, levelId)
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

    // Add outdoor landscaping
    addOutdoorLandscaping(rooms, ops, levelId)
  }

  // Execute all operations at once
  if (ops.length > 0) {
    createNodes(ops)
  }

  return createdIds
}
