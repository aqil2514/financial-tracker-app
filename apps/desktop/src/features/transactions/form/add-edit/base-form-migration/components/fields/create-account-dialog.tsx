import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountForm, defaultAccountValues } from "@/features/accounts";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function CreateAccountDialog() {
  const { createAccountOpen, setCreateAccountOpen, createAccountQuery, createAccount } =
    useTransactionFormFields();

  return (
    <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={{ ...defaultAccountValues(), name: createAccountQuery }}
          onSubmit={createAccount.onSubmit}
          isPending={createAccount.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
