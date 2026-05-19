'use client'

import {
  BuildingNode,
  CeilingNode,
  DoorNode,
  LevelNode,
  RoofNode,
  RoofSegmentNode,
  SiteNode,
  SlabNode,
  WallNode,
  WindowNode,
  type AnyNodeId,
  useScene,
} from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { AlertTriangle, CheckCircle2, Home, RotateCcw, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../toolbar-tooltip'

type PlotId = 'compact' | 'standard' | 'spacious' | 'estate'
type StyleId = 'bungalow' | 'duplex' | 'villa' | 'townhouse'
type BedroomId = '1bhk' | '2bhk' | '3bhk' | '4bhk'
type ParkingId = 'none' | 'single' | 'double' | 'carport'

type QuestionKey = 'plot' | 'style' | 'bedrooms' | 'parking'

type Selections = {
  plot: PlotId | null
  style: StyleId | null
  bedrooms: BedroomId | null
  parking: ParkingId | null
}

const PLOT_OPTIONS: { id: PlotId; label: string; width: number; depth: number }[] = [
  { id: 'compact', label: 'Compact (6×8m)', width: 6, depth: 8 },
  { id: 'standard', label: 'Standard (9×12m)', width: 9, depth: 12 },
  { id: 'spacious', label: 'Spacious (14×18m)', width: 14, depth: 18 },
  { id: 'estate', label: 'Estate (20×24m)', width: 20, depth: 24 },
]

const STYLE_OPTIONS: { id: StyleId; label: string; floors: number }[] = [
  { id: 'bungalow', label: 'Bungalow (1 floor)', floors: 1 },
  { id: 'duplex', label: 'Duplex (2 floors)', floors: 2 },
  { id: 'villa', label: 'Villa (1 floor open)', floors: 1 },
  { id: 'townhouse', label: 'Townhouse (3 floors)', floors: 3 },
]

const BEDROOM_OPTIONS: { id: BedroomId; label: string; count: number }[] = [
  { id: '1bhk', label: '1 BHK', count: 1 },
  { id: '2bhk', label: '2 BHK', count: 2 },
  { id: '3bhk', label: '3 BHK', count: 3 },
  { id: '4bhk', label: '4 BHK', count: 4 },
]

const PARKING_OPTIONS: { id: ParkingId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'single', label: 'Single garage' },
  { id: 'double', label: 'Double garage' },
  { id: 'carport', label: 'Covered carport' },
]

type DisabledMap = {
  plot: Partial<Record<PlotId, string>>
  style: Partial<Record<StyleId, string>>
  bedrooms: Partial<Record<BedroomId, string>>
  parking: Partial<Record<ParkingId, string>>
}

function computeDisabled(sel: Selections): DisabledMap {
  const disabled: DisabledMap = { plot: {}, style: {}, bedrooms: {}, parking: {} }

  if (sel.plot === 'compact') {
    disabled.style.townhouse = 'Townhouse needs a larger plot'
    disabled.style.villa = 'Villa needs a larger plot'
    disabled.bedrooms['4bhk'] = '4 BHK does not fit on a compact plot'
    disabled.parking.double = 'Double garage does not fit on a compact plot'
  }
  if (sel.plot === 'standard') {
    disabled.style.townhouse = 'Townhouse needs a larger plot'
  }
  if (sel.plot === 'estate') {
    disabled.bedrooms['1bhk'] = 'Estate plot is too large for 1 bedroom'
  }

  if (sel.style === 'bungalow') {
    disabled.bedrooms['4bhk'] = 'Bungalow cannot fit 4 BHK on one floor'
  }
  if (sel.style === 'duplex') {
    disabled.bedrooms['1bhk'] = 'Duplex requires minimum 2 bedrooms'
  }
  if (sel.style === 'villa') {
    disabled.bedrooms['4bhk'] = 'Villa open-plan does not support 4 BHK'
    disabled.plot.compact = 'Villa needs a larger plot'
  }
  if (sel.style === 'townhouse') {
    disabled.bedrooms['1bhk'] = 'Townhouse (3 floors) requires minimum 3 BHK'
    disabled.bedrooms['2bhk'] = 'Townhouse (3 floors) requires minimum 3 BHK'
    disabled.plot.compact = 'Townhouse needs a larger plot'
    disabled.plot.standard = 'Townhouse needs a larger plot'
  }

  return disabled
}

function reconcile(next: Selections): { sel: Selections; resets: string[] } {
  const resets: string[] = []
  const sel: Selections = { ...next }
  for (let i = 0; i < 4; i++) {
    const disabled = computeDisabled(sel)
    if (sel.plot && disabled.plot[sel.plot]) {
      resets.push(`Plot reset — ${disabled.plot[sel.plot]}`)
      sel.plot = null
    }
    if (sel.style && disabled.style[sel.style]) {
      resets.push(`House style reset — ${disabled.style[sel.style]}`)
      sel.style = null
    }
    if (sel.bedrooms && disabled.bedrooms[sel.bedrooms]) {
      resets.push(`Bedrooms reset — ${disabled.bedrooms[sel.bedrooms]}`)
      sel.bedrooms = null
    }
    if (sel.parking && disabled.parking[sel.parking]) {
      resets.push(`Parking reset — ${disabled.parking[sel.parking]}`)
      sel.parking = null
    }
  }
  return { sel, resets }
}

type OptionRowProps<T extends string> = {
  options: { id: T; label: string }[]
  value: T | null
  onSelect: (id: T) => void
  disabledMap: Partial<Record<T, string>>
}

function OptionRow<T extends string>({ options, value, onSelect, disabledMap }: OptionRowProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const reason = disabledMap[opt.id]
        const isDisabled = Boolean(reason)
        const isSelected = value === opt.id
        const button = (
          <button
            className={cn(
              'w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
              isSelected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-neutral-300 hover:bg-white/40 dark:hover:bg-accent/30',
              isDisabled && 'cursor-not-allowed opacity-40 hover:border-border hover:bg-background',
            )}
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelect(opt.id)}
            type="button"
          >
            {opt.label}
          </button>
        )
        if (isDisabled && reason) {
          return (
            <Tooltip key={opt.id}>
              <TooltipTrigger asChild>
                <span className="block">{button}</span>
              </TooltipTrigger>
              <TooltipContent side="right">{reason}</TooltipContent>
            </Tooltip>
          )
        }
        return <span key={opt.id}>{button}</span>
      })}
    </div>
  )
}

function Section({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-foreground text-xs">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
          {index}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      {children}
    </div>
  )
}

export function HousePlannerPanel() {
  const createNodes = useScene((state) => state.createNodes)
  const deleteNode = useScene((state) => state.deleteNode)
  const setSelection = useViewer((state) => state.setSelection)
  const setPhase = useEditor((state) => state.setPhase)

  const [selections, setSelections] = useState<Selections>({
    plot: null,
    style: null,
    bedrooms: null,
    parking: null,
  })
  const [warnings, setWarnings] = useState<string[]>([])
  const [createdNodeIds, setCreatedNodeIds] = useState<AnyNodeId[]>([])

  const disabledMap = useMemo(() => computeDisabled(selections), [selections])

  const update = <K extends QuestionKey>(key: K, value: Selections[K]) => {
    const proposed: Selections = { ...selections, [key]: value }
    const { sel, resets } = reconcile(proposed)
    setSelections(sel)
    setWarnings(resets)
  }

  const isComplete =
    selections.plot !== null &&
    selections.style !== null &&
    selections.bedrooms !== null &&
    selections.parking !== null
  const hasConflicts = warnings.length > 0
  const canGenerate = isComplete && !hasConflicts && createdNodeIds.length === 0

  const summaryTags = [
    selections.plot && PLOT_OPTIONS.find((o) => o.id === selections.plot)?.label,
    selections.style && STYLE_OPTIONS.find((o) => o.id === selections.style)?.label,
    selections.bedrooms && BEDROOM_OPTIONS.find((o) => o.id === selections.bedrooms)?.label,
    selections.parking && PARKING_OPTIONS.find((o) => o.id === selections.parking)?.label,
  ].filter((x): x is string => Boolean(x))

  const handleGenerate = () => {
    if (!canGenerate) return
    const plot = PLOT_OPTIONS.find((o) => o.id === selections.plot)
    const style = STYLE_OPTIONS.find((o) => o.id === selections.style)
    const bedrooms = BEDROOM_OPTIONS.find((o) => o.id === selections.bedrooms)
    const parking = PARKING_OPTIONS.find((o) => o.id === selections.parking)
    if (!plot || !style || !bedrooms || !parking) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = []
    const ids: AnyNodeId[] = []

    // Create site
    const site = SiteNode.parse({
      polygon: {
        type: 'polygon',
        points: [
          [-plot.width / 2, -plot.depth / 2],
          [plot.width / 2, -plot.depth / 2],
          [plot.width / 2, plot.depth / 2],
          [-plot.width / 2, plot.depth / 2],
        ],
      },
    })
    ops.push({ node: site, parentId: undefined })
    ids.push(site.id)

    // Create building
    const building = BuildingNode.parse({ position: [0, 0, 0] })
    ops.push({ node: building, parentId: site.id })
    ids.push(building.id)

    const halfW = plot.width / 2
    const halfD = plot.depth / 2
    const bedroomCount = bedrooms.count
    const cellW = plot.width / bedroomCount

    let groundLevelId = ''

    for (let floor = 0; floor < style.floors; floor++) {
      // Create level
      const level = LevelNode.parse({ level: floor })
      if (floor === 0) groundLevelId = level.id
      ops.push({ node: level, parentId: building.id })
      ids.push(level.id)

      // Outer boundary walls
      const walls: WallNode[] = []
      const frontWall = WallNode.parse({
        start: [-halfW, -halfD],
        end: [halfW, -halfD],
      })
      walls.push(frontWall)

      const rightWall = WallNode.parse({
        start: [halfW, -halfD],
        end: [halfW, halfD],
      })
      walls.push(rightWall)

      const backWall = WallNode.parse({
        start: [halfW, halfD],
        end: [-halfW, halfD],
      })
      walls.push(backWall)

      const leftWall = WallNode.parse({
        start: [-halfW, halfD],
        end: [-halfW, -halfD],
      })
      walls.push(leftWall)

      // Interior dividers between bedrooms
      for (let b = 1; b < bedroomCount; b++) {
        const x = -halfW + b * cellW
        const dividerWall = WallNode.parse({
          start: [x, -halfD],
          end: [x, halfD],
        })
        walls.push(dividerWall)
      }

      // Add all walls and their doors/windows
      for (const wall of walls) {
        ops.push({ node: wall, parentId: level.id })
        ids.push(wall.id)

        // Add doors to front wall (one entry per bedroom)
        if (
          Math.abs(wall.start[1] - (-halfD)) < 0.01 &&
          Math.abs(wall.end[1] - (-halfD)) < 0.01
        ) {
          for (let b = 0; b < bedroomCount; b++) {
            const cellStart = -halfW + b * cellW
            const doorX = cellStart + cellW / 2 - (-halfW)

            const door = DoorNode.parse({
              position: [doorX, 1.05, 0],
              rotation: [0, 0, 0],
              side: 'front',
              wallId: wall.id,
              width: Math.min(0.9, cellW - 0.2),
              height: 2.1,
              doorType: 'hinged',
              doorCategory: 'interior',
            })
            ops.push({ node: door, parentId: wall.id })
            ids.push(door.id)
          }
        }

        // Add windows to back wall (one per bedroom)
        if (
          Math.abs(wall.start[1] - halfD) < 0.01 &&
          Math.abs(wall.end[1] - halfD) < 0.01
        ) {
          for (let b = 0; b < bedroomCount; b++) {
            const cellStart = -halfW + b * cellW
            const windowX = cellStart + cellW / 2 - (-halfW)

            const window = WindowNode.parse({
              position: [windowX, 1.2, 0],
              rotation: [0, 0, 0],
              side: 'front',
              wallId: wall.id,
              width: Math.min(1.0, cellW - 0.2),
              height: 1.0,
              windowType: 'fixed',
            })
            ops.push({ node: window, parentId: wall.id })
            ids.push(window.id)
          }
        }

        // Add doors to interior dividers
        if (wall.start[0] === wall.end[0] && wall.start[0] !== -halfW && wall.start[0] !== halfW) {
          const doorX = (wall.start[1] + wall.end[1]) / 2 - wall.start[1]
          const door = DoorNode.parse({
            position: [doorX, 1.05, 0],
            rotation: [0, 0, 0],
            side: 'front',
            wallId: wall.id,
            width: 0.9,
            height: 2.1,
            doorType: 'hinged',
            doorCategory: 'interior',
          })
          ops.push({ node: door, parentId: wall.id })
          ids.push(door.id)
        }
      }

      // Create floor slab
      const slab = SlabNode.parse({
        polygon: [
          [-halfW, -halfD],
          [halfW, -halfD],
          [halfW, halfD],
          [-halfW, halfD],
        ],
      })
      ops.push({ node: slab, parentId: level.id })
      ids.push(slab.id)

      // Create ceiling
      const ceiling = CeilingNode.parse({
        polygon: [
          [-halfW, -halfD],
          [halfW, -halfD],
          [halfW, halfD],
          [-halfW, halfD],
        ],
        height: 2.5,
      })
      ops.push({ node: ceiling, parentId: level.id })
      ids.push(ceiling.id)

      // Create roof on top floor only
      if (floor === style.floors - 1) {
        const roofSegment = RoofSegmentNode.parse({
          position: [0, 0, 0],
          roofType: 'gable',
          width: plot.width,
          depth: plot.depth,
          wallHeight: 0.3,
          roofHeight: 1.5,
          overhang: 0.4,
        })
        const roof = RoofNode.parse({
          position: [0, 2.5, 0],
          children: [roofSegment.id],
        })
        ops.push({ node: roof, parentId: level.id })
        ops.push({ node: roofSegment, parentId: roof.id })
        ids.push(roof.id)
        ids.push(roofSegment.id)
      }

      // Create parking area on ground floor if selected
      if (floor === 0 && parking.id !== 'none') {
        const parkW = Math.min(4, plot.width)
        const parkD = Math.min(5, plot.depth / 3)
        const parkZStart = halfD
        const parkZEnd = halfD + parkD

        const parkFront = WallNode.parse({
          start: [-parkW / 2, parkZStart],
          end: [parkW / 2, parkZStart],
        })
        ops.push({ node: parkFront, parentId: level.id })
        ids.push(parkFront.id)

        const parkRight = WallNode.parse({
          start: [parkW / 2, parkZStart],
          end: [parkW / 2, parkZEnd],
        })
        ops.push({ node: parkRight, parentId: level.id })
        ids.push(parkRight.id)

        const parkBack = WallNode.parse({
          start: [parkW / 2, parkZEnd],
          end: [-parkW / 2, parkZEnd],
        })
        ops.push({ node: parkBack, parentId: level.id })
        ids.push(parkBack.id)

        const parkLeft = WallNode.parse({
          start: [-parkW / 2, parkZEnd],
          end: [-parkW / 2, parkZStart],
        })
        ops.push({ node: parkLeft, parentId: level.id })
        ids.push(parkLeft.id)

        // Garage door
        const garageDoor = DoorNode.parse({
          position: [parkW / 2 - 0.2, 1.05, 0],
          rotation: [0, 0, 0],
          side: 'front',
          wallId: parkFront.id,
          width: parkW - 0.4,
          height: 2.1,
          doorType: 'garage-sectional',
          doorCategory: 'garage',
        })
        ops.push({ node: garageDoor, parentId: parkFront.id })
        ids.push(garageDoor.id)

        // Parking slab
        const parkSlab = SlabNode.parse({
          polygon: [
            [-parkW / 2, parkZStart],
            [parkW / 2, parkZStart],
            [parkW / 2, parkZEnd],
            [-parkW / 2, parkZEnd],
          ],
        })
        ops.push({ node: parkSlab, parentId: level.id })
        ids.push(parkSlab.id)
      }
    }

    createNodes(ops)
    setCreatedNodeIds(ids)

    // Switch the Scene panel to the =generated building + ground floor so nodes
    // are immediately visible and selectable in the hierarchy.
    // Call setPhase first so the editor switches to structure mode (which auto-selects
    // the first available building/level), then override to our specific IDs.
    setPhase('structure')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelection({ buildingId: building.id as any, levelId: groundLevelId as any })
  }

  const handleReset = () => {
    for (const id of [...createdNodeIds].reverse()) {
      deleteNode(id)
    }
    setCreatedNodeIds([])
    setSelections({ plot: null, style: null, bedrooms: null, parking: null })
    setWarnings([])
    // setPhase('site') resets the viewer selection internally
    setPhase('site')
  }

  const statusValid = isComplete && !hasConflicts

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
        <Home className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">House Planner</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
            statusValid
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : hasConflicts
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {statusValid ? (
            <>
              <CheckCircle2 className="h-3 w-3" /> Valid
            </>
          ) : hasConflicts ? (
            <>
              <AlertTriangle className="h-3 w-3" /> Conflict
            </>
          ) : (
            <>Incomplete</>
          )}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {warnings.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-700 text-xs dark:text-amber-300">
            {warnings.map((w) => (
              <div className="flex items-start gap-1.5" key={w}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <Section index={1} title="Plot size">
          <OptionRow
            disabledMap={disabledMap.plot}
            onSelect={(id) => update('plot', id)}
            options={PLOT_OPTIONS}
            value={selections.plot}
          />
        </Section>

        <Section index={2} title="House style">
          <OptionRow
            disabledMap={disabledMap.style}
            onSelect={(id) => update('style', id)}
            options={STYLE_OPTIONS}
            value={selections.style}
          />
        </Section>

        <Section index={3} title="Bedrooms">
          <OptionRow
            disabledMap={disabledMap.bedrooms}
            onSelect={(id) => update('bedrooms', id)}
            options={BEDROOM_OPTIONS}
            value={selections.bedrooms}
          />
        </Section>

        <Section index={4} title="Parking">
          <OptionRow
            disabledMap={disabledMap.parking}
            onSelect={(id) => update('parking', id)}
            options={PARKING_OPTIONS}
            value={selections.parking}
          />
        </Section>
      </div>

      <div className="space-y-2 border-border border-t px-3 py-3">
        {summaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summaryTags.map((tag) => (
              <span
                className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {createdNodeIds.length === 0 ? (
          <button
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium text-sm transition-colors',
              canGenerate
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
            disabled={!canGenerate}
            onClick={handleGenerate}
            type="button"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate
          </button>
        ) : (
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  )
}

export default HousePlannerPanel
