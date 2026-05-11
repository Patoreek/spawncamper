import cron from 'node-cron';
import { runPriceCheck, sweepStaleRunning } from '@spawncamper/core';

// Keep this in sync with the schedule string surfaced by the API status panel.
const SCHEDULE_EXPR = '30 20 * * *'; // 20:30 every day
const SCHEDULE_TZ = 'Australia/Sydney';

const tick = async () => {
  console.log(`[scheduler] tick at ${new Date().toISOString()}`);
  const result = await runPriceCheck('scheduled');
  if (!result.ok && result.reason === 'already_running') {
    console.log('[scheduler] skipping — another run is in progress');
    return;
  }
  if (!result.ok) {
    console.error('[scheduler] run failed (see cron_runs.error column)');
    return;
  }
  console.log(`[scheduler] run ${result.runId} completed successfully`);
};

sweepStaleRunning();

cron.schedule(SCHEDULE_EXPR, tick, { timezone: SCHEDULE_TZ });
console.log(`[scheduler] armed: ${SCHEDULE_EXPR} ${SCHEDULE_TZ}`);
