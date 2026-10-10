export type CloudSyncSettings = {
  enabled: boolean;
  workerUrl: string | null;
  token: string | null;
  lastCheckpoint: string | null;
  lastAttachmentsCheckpoint: string | null;
};
