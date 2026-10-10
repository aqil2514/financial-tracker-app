import type { QueueableTable } from "../push-queue";

export type BackfillProgress = {
  table: QueueableTable;
  done: number;
  total: number;
};

export type BackfillSummary = {
  pushed: number;
  rejected: number;
  failed: number;
};
