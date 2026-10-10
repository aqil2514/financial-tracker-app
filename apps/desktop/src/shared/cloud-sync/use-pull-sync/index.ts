"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAttachmentFolder } from "@/shared/attachments/use-attachment-folder";
import {
  useCloudSyncSettings,
  useSetCloudSyncCheckpoint,
  useSetAttachmentsCheckpoint,
} from "../use-cloud-sync-settings";
import { runPull } from "./run-pull";

export function useAutoPullSync() {
  const { data: settings } = useCloudSyncSettings();
  const setCheckpoint = useSetCloudSyncCheckpoint();
  const setAttachmentsCheckpoint = useSetAttachmentsCheckpoint();
  const { data: attachmentFolder, isSuccess: attachmentFolderReady } = useAttachmentFolder();
  const queryClient = useQueryClient();
  const hasPulledRef = useRef(false);

  const enabled = !!settings?.enabled && !!settings.workerUrl && !!settings.token && attachmentFolderReady;

  useEffect(() => {
    if (!enabled || hasPulledRef.current) return;
    hasPulledRef.current = true;

    (async () => {
      try {
        const creds = { workerUrl: settings!.workerUrl!, token: settings!.token! };
        await runPull(
          creds,
          settings!.lastCheckpoint,
          settings!.lastAttachmentsCheckpoint,
          attachmentFolder ?? null,
          (checkpoint) => setCheckpoint.mutateAsync(checkpoint),
          (checkpoint) => setAttachmentsCheckpoint.mutateAsync(checkpoint),
          queryClient
        );
      } catch {
        // best-effort, lihat README.md
        hasPulledRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
