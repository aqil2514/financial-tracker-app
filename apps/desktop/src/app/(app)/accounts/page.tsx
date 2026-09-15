import { AccountFormDialog, AccountList } from "@/features/accounts";

export default function AccountsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Akun</h1>
        <AccountFormDialog />
      </div>
      <AccountList />
    </div>
  );
}
