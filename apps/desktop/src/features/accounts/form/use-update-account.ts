"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getDb, type Account } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import {
  accountSchema,
  type AccountFormOutput,
  type AccountFormValues,
} from "./account.schema";
import { accountsQueryKey } from "../list/use-accounts";

export function useUpdateAccount(account: Account) {
  const [open, setOpen] = useState(false);

  const form = useForm<AccountFormValues, unknown, AccountFormOutput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account.name,
      initial_balance: account.initial_balance,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: account.name,
        initial_balance: account.initial_balance,
      });
    }
  }, [open, account, form]);

  const updateAccount = useDbMutation({
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE accounts SET name = $1, initial_balance = $2 WHERE id = $3",
        [values.name, values.initial_balance, account.id]
      );
    },
    invalidateKey: accountsQueryKey,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
    onSuccess: () => {
      setOpen(false);
    },
  });

  function onSubmit(values: AccountFormOutput) {
    updateAccount.mutate(values);
  }

  return { open, setOpen, form, onSubmit, isPending: updateAccount.isPending };
}
