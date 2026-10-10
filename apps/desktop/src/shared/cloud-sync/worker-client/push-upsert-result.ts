export type PushUpsertResult = { status: "ok" } | { status: "ignored" } | { status: "rejected"; reason: string };
