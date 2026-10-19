import type { ReactNode } from "react"
import { Drawer } from "vaul"

export const SNAP_PEEK = "132px"
export const SNAP_HALF = 0.52
export const SNAP_FULL = 1
export type Snap = number | string | null

export function sheetOffset(snap: Snap, viewportH: number) {
  if (typeof snap === "string") return parseInt(snap, 10)
  if (snap == null) return 132
  return Math.min(snap, SNAP_HALF) * viewportH
}

/**
 * Apple-Maps-style bottom sheet: non-modal (the map stays interactive), three detents.
 * Peek shows the count, half shows a list or details, full is for reading.
 */
export function MobileSheet({ snap, onSnap, children }: { snap: Snap; onSnap: (s: Snap) => void; children: ReactNode }) {
  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={[SNAP_PEEK, SNAP_HALF, SNAP_FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={onSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="surface-float fixed inset-x-0 bottom-0 z-20 flex h-[calc(100dvh-8px)] flex-col rounded-t-2xl border-b-0 outline-none"
        >
          <Drawer.Title className="sr-only">Positions</Drawer.Title>
          <div className="flex justify-center pt-2 pb-1" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-foreground/20" />
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
