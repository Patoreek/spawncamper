export type CronRunSource = 'scheduled' | 'manual';
export type CronRunStatus = 'running' | 'success' | 'error';

export interface CronRun {
  id: number;
  source: CronRunSource;
  status: CronRunStatus;
  started_at: string;
  completed_at: string | null;
  products_checked: number;
  urls_checked: number;
  error: string | null;
}

export interface CronStatusView {
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | null;
  lastRunError: string | null;
  lastRunSource: CronRunSource | null;
  productsChecked: number;
  urlsChecked: number;
}

export interface RunPriceCheckResult {
  ok: boolean;
  runId?: number;
  /** Set when ok=false. Currently only 'already_running'. */
  reason?: 'already_running';
}
