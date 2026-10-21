"use client";

import { useQuery } from "@tanstack/react-query";
import { getRejectedLog } from "./get-rejected-log";

export const rejectedLogQueryKey = ["cloud-sync", "rejected-log"];

export function useRejectedLog() {
  return useQuery({
    queryKey: rejectedLogQueryKey,
    queryFn: getRejectedLog,
  });
}
