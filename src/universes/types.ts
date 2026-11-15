/**
 * The subset of local-time's `Universe` shape this seed emits.
 *
 * Type-only on purpose: `local-time` is not published as a package, and the seed
 * must build from a clean checkout with no private dependency. The field names,
 * enum string values and nanosecond timestamps match
 * `james-gibson/local-time` → `src/core/types.ts`, so the generated module is a
 * structural `Universe` and can be copied into a local-time registry.
 *
 * `TimePrecision` is a numeric enum upstream; `DAY_NS` is its `DAY` value and
 * `MINUTE_NS` its `MINUTE`. The exported record is a day-granularity series, so
 * its keyframes are days; a declared intervention names an instant, so it is a
 * minute.
 */
export const DAY_NS = 86_400_000_000_000
export const MINUTE_NS = 60_000_000_000

export type LocalTimeEpoch = {
  epochId?: string
  start?: bigint
  end?: bigint
  startTime?: bigint
  endTime?: bigint
  precision: number
  description?: string
}

export type LocalTimeSegment = {
  id: string
  start: bigint
  end: bigint
  type: string
  status?: 'active' | 'inactive' | 'suspended' | 'overturned' | 'amended'
  description?: string
}

export type LocalTimeKeyframe = {
  id: string
  timestamp: bigint
  significance: number
  tags: string[]
  description?: string
  certainty?: number
  precision?: number
  type?: string
}

export type LocalTimeUniverse = {
  universeId: string
  type: 'technical_log'
  identifiers: {
    primary: string
    aliases?: string[]
  }
  realityRelation: {
    type: 'documentary'
    fictionalizationDegree: number
    realityAnchors: Array<{
      realEventId: string
      relationshipType: 'documents'
      confidence: number
      evidence: string[]
    }>
  }
  attribution: {
    copyright: { holders: string[]; year: number; status: 'active' }
    citations_required: boolean
    usage_restrictions: string[]
    sources: string[]
  }
  layers: Array<{
    layerId: string
    type: 'primary'
    epochs: Record<string, LocalTimeEpoch>
  }>
  epochs: Record<string, LocalTimeEpoch>
  temporalStructure: {
    segments: LocalTimeSegment[]
    keyframes: LocalTimeKeyframe[]
    windows: { strategy: 'time_based'; avgWindowSize: bigint }
  }
  metadata: {
    canonicalName: string
    creators: string[]
    released: Date
    cultural_significance: number
    [key: string]: unknown
  }
}
