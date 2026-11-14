import SegmentedControl from '../components/silicon-ui/segmented-control/segmented-control'
import { useMotion, type MotionMode } from '../lib/motion'

const OPTIONS: { value: MotionMode; label: string }[] = [
  { value: 'still', label: 'Still' },
  { value: 'calm', label: 'Calm' },
  { value: 'full', label: 'Full' },
]

/**
 * The reader's side of the ladder: a stored motion preference, defaulting to the
 * current seed's rung. Silicon UI's own segmented control, because a control for
 * the design system should be part of the design system.
 *
 * The control has no disabled state: with the OS asking for reduced motion there
 * is nothing to choose, so it is replaced by the sentence that says so.
 */
export function MotionToggle() {
  const { mode, auto, setMode, reduced } = useMotion()

  if (reduced) {
    return (
      <span className="font-mono text-[10px] text-muted/70" aria-live="polite">
        os: reduced motion
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <SegmentedControl
        label="Motion preference"
        size="xs"
        value={mode}
        onValueChange={(next) => setMode(next as MotionMode)}
        options={OPTIONS}
      />
      <span className="hidden font-mono text-[10px] text-muted/60 2xl:inline" aria-live="polite">
        ladder: {auto}
      </span>
    </div>
  )
}
