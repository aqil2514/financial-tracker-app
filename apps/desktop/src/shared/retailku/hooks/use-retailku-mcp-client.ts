"use client";

import { useEffect, useState } from "react";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { assertRetailkuConfigured, connectRetailkuMcp } from "../helpers/connection";
import { useRetailkuSettings } from "./use-retailku-settings";

export type RetailkuMcpClientState =
  | { status: "idle" | "connecting"; client: null; error: null }
  | { status: "ready"; client: Client; error: null }
  | { status: "error"; client: null; error: Error };

export function useRetailkuMcpClient(): RetailkuMcpClientState {
  const { data: settings } = useRetailkuSettings();
  const [state, setState] = useState<RetailkuMcpClientState>({ status: "idle", client: null, error: null });

  useEffect(() => {
    if (!settings) return;

    let client: Client | null = null;
    let cancelled = false;

    setState({ status: "connecting", client: null, error: null });

    connectRetailkuMcp(assertRetailkuConfigured(settings))
      .then((connected) => {
        if (cancelled) {
          connected.close();
          return;
        }
        client = connected;
        setState({ status: "ready", client: connected, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", client: null, error: error instanceof Error ? error : new Error(String(error)) });
      });

    return () => {
      cancelled = true;
      client?.close();
    };
  }, [settings]);

  return state;
}
