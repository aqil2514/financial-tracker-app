"use client";

import { createContext, useContext, useEffect, useState, type RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useCreateAccount } from "@/features/accounts";
import { useCreateCategory } from "@/features/categories/content/list/form/use-create-category";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { useTransactionForm } from "../hooks/use-transaction-form";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

type CreateAccountField = "account_id" | "transfer_account_id";

type TransactionFormFieldsContextType = ReturnType<typeof useTransactionForm> & {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  transactionId?: string;
  isPending: boolean;
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (attachments: PendingAttachment[]) => void;
  openCreateAccount: (field: CreateAccountField, query: string) => void;
  createAccountOpen: boolean;
  setCreateAccountOpen: (open: boolean) => void;
  createAccountQuery: string;
  createAccount: ReturnType<typeof useCreateAccount>;
  openCreateCategory: (query: string) => void;
  createCategory: ReturnType<typeof useCreateCategory>;
};

const TransactionFormFieldsContext = createContext<TransactionFormFieldsContextType | undefined>(
  undefined
);

type TransactionFormFieldsProviderProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  handleSubmitRef: RefObject<(values: TransactionFormOutput) => void>;
  transactionId?: string;
  isPending: boolean;
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (attachments: PendingAttachment[]) => void;
  children: React.ReactNode;
};

export function TransactionFormFieldsProvider({
  form,
  onSubmit,
  handleSubmitRef,
  transactionId,
  isPending,
  pendingAttachments,
  onPendingAttachmentsChange,
  children,
}: TransactionFormFieldsProviderProps) {
  const fields = useTransactionForm({ form, onSubmit, transactionId });

  useEffect(() => {
    handleSubmitRef.current = fields.handleSubmit;
  });

  const [createAccountFor, setCreateAccountFor] = useState<CreateAccountField | null>(null);
  const [createAccountQuery, setCreateAccountQuery] = useState("");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [createCategoryQuery, setCreateCategoryQuery] = useState("");

  const createAccount = useCreateAccount({
    onCreated: (id) => {
      setCreateAccountOpen(false);
      if (createAccountFor) form.setValue(createAccountFor, id, { shouldValidate: true });
    },
  });

  const createCategory = useCreateCategory({
    initialValues: { name: createCategoryQuery, type: "expense" },
    onCreated: () => {},
  });

  function openCreateAccount(field: CreateAccountField, query: string) {
    setCreateAccountFor(field);
    setCreateAccountQuery(query);
    setCreateAccountOpen(true);
  }

  function openCreateCategory(query: string) {
    setCreateCategoryQuery(query);
    createCategory.setOpen(true);
  }

  return (
    <TransactionFormFieldsContext.Provider
      value={{
        ...fields,
        form,
        transactionId,
        isPending,
        pendingAttachments,
        onPendingAttachmentsChange,
        openCreateAccount,
        createAccountOpen,
        setCreateAccountOpen,
        createAccountQuery,
        createAccount,
        openCreateCategory,
        createCategory,
      }}
    >
      {children}
    </TransactionFormFieldsContext.Provider>
  );
}

export function useTransactionFormFields() {
  const context = useContext(TransactionFormFieldsContext);
  if (!context) {
    throw new Error("useTransactionFormFields must be used within TransactionFormFieldsProvider");
  }
  return context;
}
