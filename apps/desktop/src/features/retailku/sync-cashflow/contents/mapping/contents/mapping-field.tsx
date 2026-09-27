import { ArrayFieldTabs } from "@/components/pattern/array-field-tabs";
import { useRetailkuSyncCashflowMapping } from "../context";
import type { MappingRowDraft } from "../context/interfaces";
import { FlexRenderForm } from "../form";

export function MappingField() {
  const { candidates, filter, draftState, resources } =
    useRetailkuSyncCashflowMapping();
  const { rows } = candidates;
  const { activeKey, setActiveKey } = filter;
  const { updateDraft } = draftState;
  const { localAccountOptions, categoryOptions } = resources;

  return (
    <div className="min-w-0 space-y-3">
      <ArrayFieldTabs
        items={rows.map((row) => ({ ...row, id: row.key }))}
        activeId={activeKey ?? rows[0]?.key}
        onActiveChange={setActiveKey}
        renderContent={(row: MappingRowDraft & { id: string }) => (
          <FlexRenderForm
            row={row}
            localAccountOptions={localAccountOptions}
            categoryOptions={categoryOptions}
            onChange={(patch) => updateDraft(row.key, patch)}
          />
        )}
      />
    </div>
  );
}
