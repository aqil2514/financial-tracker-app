import { ArrayFieldTabs } from "@/components/pattern/array-field-tabs";
import { useRetailkuSyncCashflowMapping } from "../context";

export function MappingField() {
  const { candidates, filter } = useRetailkuSyncCashflowMapping();
  const { rows } = candidates;
  const { activeKey, setActiveKey } = filter;
  return (
    <div className="min-w-0 space-y-3">
      <ArrayFieldTabs
        items={rows.map((row) => ({ ...row, id: row.key }))}
        activeId={activeKey ?? rows[0]?.key}
        onActiveChange={setActiveKey}
        renderContent={() => <div> P </div>}
      />
    </div>
  );
}
