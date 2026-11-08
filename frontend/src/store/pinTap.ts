/**
 * pinTap — a seam for consumers that need every digital pin transition the
 * simulator reports, whether or not an oscilloscope channel is watching it.
 *
 * The oscilloscope callback in useSimulatorStore is the single place every
 * board family routes `onPinChangeWithTime` through. Embeddings that grade an
 * experiment need the same edge stream without opening a scope channel.
 */

export type PinTap = (boardId: string, pin: number, state: boolean, timeMs: number) => void

let tap: PinTap | null = null
let warned = false

/** Install (or clear with null) the single pin-edge consumer. */
export function installPinTap(fn: PinTap | null): void {
  tap = fn
}

/** Called from the oscilloscope callback for every board pin edge. */
export function emitPinTap(boardId: string, pin: number, state: boolean, timeMs: number): void {
  if (!tap) return
  try {
    tap(boardId, pin, state, timeMs)
  } catch (err) {
    if (!warned) {
      warned = true
      console.warn('[pinTap] tap threw; further errors are silent:', err)
    }
  }
}
