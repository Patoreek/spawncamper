import cron from 'node-cron';
import { runPriceCheck, sendDigest, sweepStaleRunning } from '@spawncamper/core';

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

const digestTick = async () => {
  console.log(`[digest] tick at ${new Date().toISOString()}`);
  const result = await sendDigest();
  if (result.sent) {
    console.log(`[digest] sent (${result.rowCount} product${result.rowCount === 1 ? '' : 's'})`);
    return;
  }
  console.log(`[digest] skipped: ${result.skippedReason ?? 'unknown'} (${result.rowCount} products)`);
};

sweepStaleRunning();

cron.schedule(SCHEDULE_EXPR, tick, { timezone: SCHEDULE_TZ });
console.log(`[scheduler] armed: ${SCHEDULE_EXPR} ${SCHEDULE_TZ}`);

// Digest cron is opt-in. Unset DIGEST_CRON → no digest. Default TZ matches the
// price-check schedule above so the two stay coordinated by default.
const digestExpr = process.env.DIGEST_CRON;
const digestTz = process.env.DIGEST_TZ || SCHEDULE_TZ;
if (digestExpr) {
  if (!cron.validate(digestExpr)) {
    console.warn(`[digest] DIGEST_CRON='${digestExpr}' is not a valid cron expression — digest disabled`);
  } else {
    cron.schedule(digestExpr, digestTick, { timezone: digestTz });
    console.log(`[digest] armed: ${digestExpr} ${digestTz}`);
  }
} else {
  console.log('[digest] DIGEST_CRON not set — daily digest disabled');
}
