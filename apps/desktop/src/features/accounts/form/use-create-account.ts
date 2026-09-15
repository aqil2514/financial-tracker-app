"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import {
  accountSchema,
  type AccountFormOutput,
  type AccountFormValues,
} from "./account.schema";
import { accountsQueryKey } from "../list/use-accounts";

export function useCreateAccount() {
  const [open, setOpen] = useState(false);

  const form = useForm<AccountFormValues, unknown, AccountFormOutput>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", initial_balance: 0 },
  });

  const createAccount = useDbMutation({
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO accounts (name, initial_balance) VALUES ($1, $2)",
        [values.name, values.initial_balance]
      );
    },
    invalidateKey: accountsQueryKey,
    successMessage: "Akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan akun",
    onSuccess: () => {
      form.reset();
      setOpen(false);
    },
  });

  function onSubmit(values: AccountFormOutput) {
    createAccount.mutate(values);
  }

  return { open, setOpen, form, onSubmit, isPending: createAccount.isPending };
}
