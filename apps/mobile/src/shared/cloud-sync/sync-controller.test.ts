import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { createSyncController, isFormRoute, type SyncSnapshot } from "./sync-controller";
import { getSyncState } from "./sync-state";
import type { FetchLike } from "./worker-client";

const creds = { workerUrl: "https://worker.test", token: "tok" };

function makeFetch(options: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push(`${init.method ?? "GET"} ${url.replace("https://worker.test", "")}`);
    if (options.fail) throw new TypeError("Network request failed");
    const body = url.includes("/attachments")
      ? { checkpoint: "2026-11-04 10:00:00", attachments: [] }
      : url.includes("/sync")
      ? {
          checkpoint: "2026-11-04 10:00:00",
          accountGroups: [], categories: [], contacts: [], labels: [], transactionLabels: [], categoryLabels: [], accountLabels: [], accounts: [], transactions: [], debts: [],
          debtPayments: [], debtAccounts: [], investmentAccounts: [], investmentPurchases: [],
          investmentSales: [], categoryPeriods: [], thirdPartyFunds: [],
        }
      : { status: "ok" };
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as FetchLike;
  return { calls, impl };
}

describe("sync-controller", () => {
  let db: SQLiteDatabase;
  let clock: number;
  let canPull: boolean;
  let configured: boolean;
  let snapshots: SyncSnapshot[];

  const build = (fetchImpl: FetchLike) =>
    createSyncController({
      db,
      getCredentials: async () => (configured ? creds : null),
      canPull: () => canPull,
      onChange: (snapshot) => snapshots.push(snapshot),
      fetchImpl,
      now: () => clock,
    });

  beforeEach(async () => {
    db = await createSqliteTestDb();
    clock = 1_000_000;
    canPull = true;
    configured = true;
    snapshots = [];
  });

  it("tanpa kredensial status off dan tidak ada request", async () => {
    configured = false;
    const { calls, impl } = makeFetch();
    const controller = build(impl);
    expect(await controller.syncNow()).toBe(false);
    await controller.pushIfPending();
    expect(calls).toEqual([]);
    expect(controller.getSnapshot().status).toBe("off");
  });

  it("syncNow: kirim lalu tarik, checkpoint maju, status idle", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const { calls, impl } = makeFetch();
    const controller = build(impl);
    await controller.syncNow();

    expect(calls).toEqual(["POST /contacts", "GET /sync", "GET /attachments"]);
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", pending: 0, lastSyncAt: clock });
    expect((await getSyncState(db)).checkpoint).toBe("2026-11-04 10:00:00");
  });

  it("canPull false: hanya mengirim, tidak menarik", async () => {
    canPull = false;
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const { calls, impl } = makeFetch();
    await build(impl).syncNow();
    expect(calls).toEqual(["POST /contacts"]);
  });

  it("pushIfPending hanya mengirim kalau ada antrean, dan tidak menarik", async () => {
    const { calls, impl } = makeFetch();
    const controller = build(impl);
    await controller.pushIfPending();
    expect(calls).toEqual([]);

    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await controller.pushIfPending();
    expect(calls).toEqual(["POST /contacts"]);
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", pending: 0 });
  });

  it("gagal jaringan: status error, backoff 30 detik untuk pemicu otomatis, tapi syncNow tetap jalan", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const failing = makeFetch({ fail: true });
    const controller = build(failing.impl);

    await controller.pushIfPending();
    expect(controller.getSnapshot()).toMatchObject({ status: "error", lastError: "Jaringan bermasalah saat mengirim", pending: 1 });
    expect(failing.calls).toHaveLength(1);

    clock += 10_000;
    await controller.pushIfPending();
    expect(failing.calls).toHaveLength(1);

    clock += 25_000;
    await controller.pushIfPending();
    expect(failing.calls).toHaveLength(2);

    await controller.syncNow();
    expect(failing.calls).toHaveLength(3);
  });

  it("entry yang habis percobaan tidak dihitung menunggu dan tidak memicu kirim otomatis", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync("UPDATE cloud_sync_queue SET attempts = 5, last_error = 'Invalid payload'");
    const { calls, impl } = makeFetch();
    const controller = build(impl);

    await controller.pushIfPending();
    expect(calls).toEqual([]);
    expect(controller.getSnapshot().pending).toBe(0);

    await controller.syncNow();
    expect(calls).toContain("POST /contacts");
  });

  it("onAppActive dibatasi interval minimum 15 detik", async () => {
    const { calls, impl } = makeFetch();
    const controller = build(impl);
    await controller.onAppActive();
    const afterFirst = calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    clock += 5_000;
    await controller.onAppActive();
    expect(calls).toHaveLength(afterFirst);

    clock += 20_000;
    await controller.onAppActive();
    expect(calls.length).toBeGreaterThan(afterFirst);
  });

  it("tidak menjalankan dua sync bersamaan", async () => {
    const { calls, impl } = makeFetch();
    const controller = build(impl);
    const results = await Promise.all([controller.syncNow(), controller.syncNow()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(calls.filter((call) => call === "GET /sync")).toHaveLength(1);
  });
});

describe("isFormRoute", () => {
  it.each([
    ["/transactions/new", true],
    ["/transactions/01a1/edit", true],
    ["/investments/abc/sell", true],
    ["/investments/abc/write-off", true],
    ["/third-party/record", true],
    ["/third-party/move", true],
    ["/investments/abc/edit-purchase", true],
    ["/accounts/group/g1/edit", true],
    ["/transactions", false],
    ["/settings", false],
    ["/investments/abc", false],
    ["/", false],
  ])("%s -> %s", (path, expected) => {
    expect(isFormRoute(path)).toBe(expected);
  });
});
