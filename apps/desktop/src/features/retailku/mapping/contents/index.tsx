import { useRetailkuSyncCashflowMapping } from "../context";
import { MappingOverviewPanel } from "./mapping-overview-panel";
import { MappingField } from "./mapping-field";
import { SaveMappingButton } from "./save-mapping-button";
import { ErrorComponent, NoDataComponent } from "./states-components";

export function Contents() {
  const { loadKeysError, hasLoadedKeys } =
    useRetailkuSyncCashflowMapping().loads;
  const { rows } = useRetailkuSyncCashflowMapping().candidates;

  if (loadKeysError) return <ErrorComponent />;

  if (!hasLoadedKeys && rows.length === 0 && !loadKeysError)
    return <NoDataComponent />;

  if (rows.length > 0)
    return (
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_2fr]">
        <MappingOverviewPanel />
        <div className="min-w-0 space-y-3">
          <MappingField />
          <SaveMappingButton />
        </div>
      </div>
    );
}
