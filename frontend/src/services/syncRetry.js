/**
 * Sync Retry Service — Queues failed sync calls and auto-flushes on reconnect
 *
 * WBS Task 8.12
 *
 * Critical for streak integrity (Risk R9):
 *   - If a WON/LOST sync fails mid-game (network drop), the payload is queued.
 *   - When navigator.onLine fires 'online', the queue is flushed with exponential backoff.
 *   - Max 3 retries per item.
 */

import { gameApi } from './api.js';

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

/** @type {{ dto: object, retries: number }[]} */
let queue = [];
let isFlushing = false;

/**
 * Add a sync payload to the retry queue.
 * @param {{ id: string, guesses: string[], status: string }} dto
 */
export function enqueueSyncRetry(dto) {
  // Deduplicate by game id — keep the latest payload
  queue = queue.filter((item) => item.dto.id !== dto.id);
  queue.push({ dto, retries: 0 });
  console.debug('[SyncRetry] Enqueued sync for game', dto.id);
}

/** Flush all queued sync payloads (retrying with exponential backoff) */
async function flushQueue() {
  if (isFlushing || queue.length === 0) return;
  isFlushing = true;
  console.debug('[SyncRetry] Flushing', queue.length, 'queued syncs');

  const results = await Promise.all(queue.map(async (item) => {
    try {
      await gameApi.sync(item.dto);
      console.debug('[SyncRetry] Successfully synced game', item.dto.id);
      return null;
    } catch (err) {
      const retries = item.retries + 1;
      if (retries < MAX_RETRIES) {
        // Exponential backoff
        const delay = BACKOFF_BASE_MS * Math.pow(2, retries - 1);
        await new Promise((r) => setTimeout(r, delay));
        return { ...item, retries };
      }

      console.error('[SyncRetry] Max retries exceeded for game', item.dto.id, err);
      return null;
    }
  }));

  queue = results.filter(Boolean);
  isFlushing = false;
}

/** Initialize the online event listener — call once at app startup */
export function initSyncRetryService() {
  window.addEventListener('online', () => {
    console.debug('[SyncRetry] Back online — flushing queue');
    flushQueue();
  });

  // Also try to flush on visibility change (tab regains focus)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushQueue();
    }
  });
}

/** Exposed for testing */
export function getQueueLength() {
  return queue.length;
}
