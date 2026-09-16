import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountGroupList, AccountGroupFormDialog } from "@/features/account-groups";
import { ImportMoneyManagerDialog } from "@/features/data-import";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Group Akun</CardTitle>
          <CardAction>
            <AccountGroupFormDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <AccountGroupList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Import data akun, kategori, dan transaksi dari file backup Money
            Manager (.mmbak). Seluruh data yang ada saat ini akan diganti.
          </p>
          <ImportMoneyManagerDialog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Key AI Assistant</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Belum ada pengaturan. Menyusul.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
