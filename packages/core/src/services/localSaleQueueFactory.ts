// packages/core/src/services/localSaleQueueFactory.ts
// ─────────────────────────────────────────────────────────────
import { platform } from '../platform/PlatformDetectionService'
import type { ILocalSaleQueue } from './interfaces/ILocalSaleQueue'
import { TauriLocalSaleQueue } from './desktop/TauriLocalSaleQueue'
import { InMemorySaleQueue } from './web/InMemorySaleQueue'

let cachedInstance: ILocalSaleQueue | null = null

export function getLocalSaleQueue(): ILocalSaleQueue {
  if (!cachedInstance) {
    cachedInstance = platform.isDesktop()
      ? new TauriLocalSaleQueue()
      : new InMemorySaleQueue()
  }
  return cachedInstance
}

export function __resetLocalSaleQueueForTests(): void {
  cachedInstance = null
}
