import React, { useMemo } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { QueryState } from "@/components/query-state";
import { CardContent } from "@/components/ui/card";
import { useRetailkuAccountMapping } from "@/shared/retailku";
import { AccountWithBalance } from "../../../calculate-balance";
import { useAccountsList } from "../context";
import { AccountCard } from "./account-card";

// Dipakai sebagai group_id akun yang group_id-nya null — group_id asli
// selalu UUID (lihat migrations/0027), jadi string ini tidak pernah
// bentrok dengan id grup akun sungguhan.
const UNGROUPED_KEY = "__ungrouped__";

interface AccountGroupSection {
  key: string;
  name: string;
  accounts: AccountWithBalance[];
}

export function AccountListContent() {
  const { error, isLoading } = useAccountsList();
  return (
    <CardContent>
      <QueryState isLoading={isLoading} error={error} />
      <AccountGroupedList />
    </CardContent>
  );
}

function AccountGroupedList() {
  const { accounts } = useAccountsList();

  const groups = useMemo<AccountGroupSection[]>(() => {
    if (!accounts) return [];

    const byGroup = new Map<string, AccountGroupSection>();
    for (const account of accounts) {
      const key = account.group_id ?? UNGROUPED_KEY;
      const name = account.group_name ?? "Tanpa Grup";
      const section = byGroup.get(key);
      if (section) {
        section.accounts.push(account);
      } else {
        byGroup.set(key, { key, name, accounts: [account] });
      }
    }

    // Grup "Tanpa Grup" selalu di akhir, grup lain urut sesuai kemunculan
    // pertama (mengikuti urutan sort yang sudah diterapkan query-nya).
    return [...byGroup.values()].sort((a, b) => {
      if (a.key === UNGROUPED_KEY) return 1;
      if (b.key === UNGROUPED_KEY) return -1;
      return 0;
    });
  }, [accounts]);

  if (accounts && accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada akun. Tambahkan lewat tombol di atas.
      </p>
    );
  }

  if (!accounts) return null;

  // key berubah mengikuti susunan grup — defaultValue base-ui Accordion
  // hanya dipakai saat mount, jadi tanpa ini accordion grup BARU (mis.
  // muncul karena filter berubah) bisa ikut state lama alih-alih
  // default terbuka.
  const groupsKey = groups.map((group) => group.key).join(",");

  return (
    <Accordion
      key={groupsKey}
      multiple
      defaultValue={groups.map((group) => group.key)}
      className="gap-4"
    >
      {groups.map((group) => (
        <AccordionItem
          key={group.key}
          value={group.key}
          className="not-last:border-b-0 rounded-lg border bg-muted/30 px-4"
        >
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">
            {group.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {group.accounts.length} akun
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <WithAccounts accounts={group.accounts} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

const WithAccounts: React.FC<{ accounts: AccountWithBalance[] }> = ({ accounts }) => {
  const { data: retailkuMapping } = useRetailkuAccountMapping();

  return accounts.map((account) => {
    const linkedRetailkuAccounts = (retailkuMapping ?? []).filter(
      (row) => row.localAccountId === account.id
    );
    return (
      <AccountCard
        account={account}
        linkedRetailkuAccounts={linkedRetailkuAccounts}
        key={account.id}
      />
    );
  });
};
