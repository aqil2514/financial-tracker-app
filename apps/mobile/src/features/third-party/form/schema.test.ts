import { describe, expect, it } from "vitest";
import { moveFundFormSchema, resolveMoveDestination } from "./schema";

type MoveValues = {
  kind: "move_location" | "move_ownership" | "both";
  source_account_id: string | null;
  source_contact_id: string | null;
  destination_account_id: string | null;
  destination_contact_id: string | null;
  amount: number;
  date: string;
  note: string;
};

const base: MoveValues = {
  kind: "move_location",
  source_account_id: "tunai",
  source_contact_id: "adel",
  destination_account_id: null,
  destination_contact_id: null,
  amount: 1000,
  date: "2026-11-03T00:00:00.000Z",
  note: "",
};

function messages(values: MoveValues) {
  const result = moveFundFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("resolveMoveDestination", () => {
  it("pindah tempat: kontak tujuan = kontak asal", () => {
    expect(resolveMoveDestination({ ...base, destination_account_id: "jago", destination_contact_id: "mama" })).toEqual({
      accountId: "jago",
      contactId: "adel",
    });
  });

  it("pindah kepemilikan: akun tujuan = akun asal", () => {
    expect(
      resolveMoveDestination({
        ...base,
        kind: "move_ownership",
        destination_account_id: "jago",
        destination_contact_id: "mama",
      })
    ).toEqual({ accountId: "tunai", contactId: "mama" });
  });

  it("keduanya: apa adanya", () => {
    expect(
      resolveMoveDestination({ ...base, kind: "both", destination_account_id: "jago", destination_contact_id: "mama" })
    ).toEqual({ accountId: "jago", contactId: "mama" });
  });
});

describe("moveFundFormSchema", () => {
  it("pindah tempat butuh akun tujuan, tidak butuh kontak tujuan", () => {
    expect(messages(base)).toEqual(["Akun tujuan wajib dipilih"]);
    expect(messages({ ...base, destination_account_id: "jago" })).toEqual([]);
  });

  it("pindah kepemilikan butuh kontak tujuan, tidak butuh akun tujuan", () => {
    expect(messages({ ...base, kind: "move_ownership" })).toEqual(["Kontak tujuan wajib dipilih"]);
    expect(messages({ ...base, kind: "move_ownership", destination_contact_id: "mama" })).toEqual([]);
  });

  it("keduanya butuh akun dan kontak tujuan", () => {
    expect(messages({ ...base, kind: "both" })).toHaveLength(2);
  });

  it("tujuan sama dengan asal ditolak", () => {
    expect(messages({ ...base, destination_account_id: "tunai" })).toEqual([
      "Tujuan sama dengan asal — tidak ada yang dipindahkan",
    ]);
    expect(messages({ ...base, kind: "move_ownership", destination_contact_id: "adel" })).toEqual([
      "Tujuan sama dengan asal — tidak ada yang dipindahkan",
    ]);
    expect(
      messages({ ...base, kind: "both", destination_account_id: "tunai", destination_contact_id: "adel" })
    ).toHaveLength(1);
  });

  it("nominal harus lebih dari 0", () => {
    expect(messages({ ...base, destination_account_id: "jago", amount: 0 })).toEqual([
      "Nominal harus lebih dari 0",
    ]);
  });
});
