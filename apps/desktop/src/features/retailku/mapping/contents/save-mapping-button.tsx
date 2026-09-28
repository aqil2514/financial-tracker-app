import { Button } from "@/components/ui/button";
import { useRetailkuSyncCashflowMapping } from "../context";

export function SaveMappingButton() {
  const { isDirty, handleSave, isSaving } = useRetailkuSyncCashflowMapping().save;

  if (!isDirty) return null;

  return (
    <Button onClick={handleSave} disabled={isSaving}>
      {isSaving ? "Menyimpan..." : "Simpan Mapping"}
    </Button>
  );
}
