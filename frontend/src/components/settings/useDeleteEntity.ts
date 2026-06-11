import { useState } from 'react'
import type { TradeCount } from '@/types/referenceData'
import { notifyError, notifySuccess } from './notify'

/** Minimal shape a deletable Settings entity must expose. */
interface Deletable {
  id: number
  name: string
}

interface UseDeleteEntityOptions<T extends Deletable> {
  /** Fetch how many trades reference the entity (drives the modal variant). */
  countFn: (id: number) => Promise<TradeCount>
  /** Hard-delete the entity. */
  deleteFn: (id: number) => Promise<void>
  /** Refresh the list after a successful delete. */
  onDeleted: () => void
  /** Success toast message, given the deleted entity's name. */
  successMessage: (entity: T) => string
  /** Fallback error toast message when the delete request fails. */
  errorMessage: string
}

export interface DeleteEntityController<T extends Deletable> {
  /** The entity pending deletion, or `null` when the modal is closed. */
  target: T | null
  /** Trade count for `target`, or `null` while it is still loading. */
  tradeCount: number | null
  countLoading: boolean
  countError: boolean
  pending: boolean
  /** Open the modal for an entity and fetch its trade count. */
  open: (entity: T) => void
  /** Close the modal (ignored while a delete is in flight). */
  close: () => void
  /** Run the delete for the current target. */
  confirm: () => void
}

/**
 * Drives a row-level delete flow on the Settings page: opening the modal,
 * fetching the entity's trade count, and running the guarded/cascade delete.
 * Shared by the Tags, Emotions, and Assets tabs.
 */
export function useDeleteEntity<T extends Deletable>(
  options: UseDeleteEntityOptions<T>,
): DeleteEntityController<T> {
  const [target, setTarget] = useState<T | null>(null)
  const [tradeCount, setTradeCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [countError, setCountError] = useState(false)
  const [pending, setPending] = useState(false)

  const open = async (entity: T) => {
    setTarget(entity)
    setTradeCount(null)
    setCountError(false)
    setCountLoading(true)
    try {
      const { trade_count } = await options.countFn(entity.id)
      setTradeCount(trade_count)
    } catch {
      setCountError(true)
    } finally {
      setCountLoading(false)
    }
  }

  const close = () => {
    if (!pending) {
      setTarget(null)
    }
  }

  const confirm = async () => {
    if (!target) {
      return
    }
    setPending(true)
    try {
      await options.deleteFn(target.id)
      notifySuccess(options.successMessage(target))
      setTarget(null)
      options.onDeleted()
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : options.errorMessage)
    } finally {
      setPending(false)
    }
  }

  return { target, tradeCount, countLoading, countError, pending, open, close, confirm }
}
