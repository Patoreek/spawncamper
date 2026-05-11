import { db } from '../db/db';
import { checkAllProducts } from '../price_checker/service';
import { CronRunsDal } from './dal';
import type {
  CronRunSource,
  CronStatusView,
  RunPriceCheckResult,
} from './types';

const STALE_CUTOFF_MINUTES = 60;

const cronRunsDal = new CronRunsDal(db);

const isUniqueConstraint = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT';
};

/**
 * Run a full price-check pass, recording start / finish in `cron_runs`.
 *
 * The unique partial index on `cron_runs(status) WHERE status='running'`
 * guarantees only one run is in flight across all processes at any time —
 * if another run is already going, the insert throws and we return
 * { ok: false, reason: 'already_running' }.
 */
export const runPriceCheck = async (source: CronRunSource): Promise<RunPriceCheckResult> => {
  let runId: number;
  try {
    runId = cronRunsDal.startRun(source);
  } catch (err) {
    if (isUniqueConstraint(err)) {
      return { ok: false, reason: 'already_running' };
    }
    throw err;
  }

  try {
    const result = await checkAllProducts();
    cronRunsDal.finishSuccess(runId, result.productsChecked, result.urlsChecked);
    return { ok: true, runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cronRunsDal.finishError(runId, message);
    console.error('[cron] run failed:', err);
    return { ok: false, runId };
  }
};

/**
 * Mark any 'running' row older than the stale cutoff as error. Called on
 * process boot to clean up rows left behind by crashed/killed processes.
 */
export const sweepStaleRunning = (): number => {
  const swept = cronRunsDal.sweepStale(STALE_CUTOFF_MINUTES);
  if (swept > 0) {
    console.warn(`[cron] swept ${swept} stale running row(s) on boot`);
  }
  return swept;
};

/** Snapshot suitable for the status panel. */
export const getCronStatus = (): CronStatusView => {
  const running = cronRunsDal.findRunning();
  const latest = cronRunsDal.findLatestCompleted();
  return {
    isRunning: running !== null,
    lastRunAt: latest?.completed_at ?? null,
    lastRunStatus: latest ? (latest.status as 'success' | 'error') : null,
    lastRunError: latest?.error ?? null,
    lastRunSource: latest?.source ?? null,
    productsChecked: latest?.products_checked ?? 0,
    urlsChecked: latest?.urls_checked ?? 0,
  };
};
