import { Dispatch, SetStateAction } from "react";
import { GenericMappingRowDraft, TransferMappingRowDraft } from "./use-mapping-candidates";

/** `Partial<MappingRowDraft>` (union) TIDAK dipakai di sini — TypeScript
 * mendistribusikan `Partial` ke tiap anggota union LEBIH DULU, hasilnya
 * masih union (patch harus cocok SATU varian lengkap), padahal
 * `updateDraft` dipanggil per FIELD lintas varian (mis. cuma
 * `{ localAccountId }`, bisa dari form generic ATAU transfer). Union
 * MANUAL dari tiap varian di-`Partial`-kan SENDIRI dulu (bukan
 * `Partial<Omit<Union, ...>>`, yang ternyata JUGA didistribusikan
 * TypeScript) baru digabung `&` jadi satu shape flat opsional-semua. */
export type MappingRowDraftPatch = Partial<Omit<GenericMappingRowDraft, "key" | "sourceType">> &
  Partial<Omit<TransferMappingRowDraft, "key" | "sourceType">>;

export interface UseDraftStateOutput {
  drafts: Record<string, MappingRowDraftPatch>;
  setDrafts: Dispatch<SetStateAction<Record<string, MappingRowDraftPatch>>>;
  updateDraft(key: string, patch: MappingRowDraftPatch): void;
}
