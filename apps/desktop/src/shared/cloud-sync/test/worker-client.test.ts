import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerRequestError, pullSync, pushAccountGroup, testCloudSyncConnection } from "../worker-client";

const CREDS = { workerUrl: "https://worker.example.test", token: "secret-token" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request (via testCloudSyncConnection)", () => {
  it("mengirim Authorization header dan URL yang benar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await testCloudSyncConnection(CREDS);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.test/health",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-token" }),
      })
    );
  });

  it("trailing slash di workerUrl tidak menghasilkan double slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await testCloudSyncConnection({ ...CREDS, workerUrl: "https://worker.example.test/" });

    expect(fetchMock).toHaveBeenCalledWith("https://worker.example.test/health", expect.anything());
  });

  it("response bukan ok (di luar jalur pushUpsert) -> throw WorkerRequestError dgn status & message dari body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Internal error" })));

    await expect(pullSync(CREDS, null)).rejects.toMatchObject({
      status: 500,
      message: "Internal error",
    });
  });
});

describe("testCloudSyncConnection", () => {
  it("request sukses -> true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" })));
    await expect(testCloudSyncConnection(CREDS)).resolves.toBe(true);
  });

  it("request gagal (network/HTTP error) -> false, TIDAK throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(testCloudSyncConnection(CREDS)).resolves.toBe(false);
  });

  it("401 unauthorized -> false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
    await expect(testCloudSyncConnection(CREDS)).resolves.toBe(false);
  });
});

describe("pushAccountGroup (UPSERT LWW)", () => {
  it("status 201 polos -> { status: 'ok' }", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, { status: "ok", id: "grp-1" })));
    const result = await pushAccountGroup(CREDS, { id: "grp-1", name: "Tabungan" });
    expect(result).toEqual({ status: "ok" });
  });

  it("response status 'ignored' -> { status: 'ignored' }, BUKAN error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "ignored", id: "grp-1" })));
    const result = await pushAccountGroup(CREDS, { id: "grp-1", name: "Tabungan (stale)" });
    expect(result).toEqual({ status: "ignored" });
  });

  it("422 dari Worker -> { status: 'rejected', reason }, BUKAN throw ke caller", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(422, { error: "Nama tidak boleh kosong" })));
    const result = await pushAccountGroup(CREDS, { id: "grp-1", name: "" });
    expect(result).toEqual({ status: "rejected", reason: "Nama tidak boleh kosong" });
  });

  it("error NON-422 (mis. 500) tetap di-throw, bukan ditelan jadi 'rejected'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Internal error" })));
    await expect(pushAccountGroup(CREDS, { id: "grp-1", name: "x" })).rejects.toBeInstanceOf(WorkerRequestError);
  });

  it("mengirim payload persis sbg JSON body (termasuk updatedAt)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { status: "ok", id: "grp-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await pushAccountGroup(CREDS, { id: "grp-1", name: "Tabungan", updatedAt: "2026-10-01 10:00:00" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      id: "grp-1",
      name: "Tabungan",
      updatedAt: "2026-10-01 10:00:00",
    });
  });
});

describe("pullSync", () => {
  it("since null -> query string kosong (full snapshot)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        checkpoint: "2026-10-01 12:00:00",
        accountGroups: [],
        categories: [],
        contacts: [],
        accounts: [],
        transactions: [],
        debts: [],
        debtPayments: [],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullSync(CREDS, null);

    expect(fetchMock).toHaveBeenCalledWith("https://worker.example.test/sync", expect.anything());
    expect(result.checkpoint).toBe("2026-10-01 12:00:00");
  });

  it("since terisi -> dikirim sbg query param ter-encode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        checkpoint: "2026-10-01 12:00:00",
        accountGroups: [],
        categories: [],
        contacts: [],
        accounts: [],
        transactions: [],
        debts: [],
        debtPayments: [],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await pullSync(CREDS, "2026-10-01 10:00:00");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.test/sync?since=2026-10-01%2010%3A00%3A00",
      expect.anything()
    );
  });
});
