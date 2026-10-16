"use client";

import type { AccountWithBalance } from "@/features/accounts";
import type { Category } from "@/lib/db";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { Badge } from "@/components/ui/badge";

type UseAccountCategoryOptionsParams = {
  accounts: AccountWithBalance[] | undefined;
  categories: Category[] | undefined;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
};

export function useAccountCategoryOptions({
  accounts,
  categories,
  type,
  accountId,
  transferAccountId,
  categoryId,
}: UseAccountCategoryOptionsParams) {
  const accountOptions =
    accounts
      ?.filter(
        (account) =>
          account.is_active ||
          String(account.id) === accountId ||
          String(account.id) === transferAccountId
      )
      .map((account) => ({
        value: String(account.id),
        label: account.group_name
          ? `${account.name} — ${account.group_name}`
          : account.name,
      })) ?? [];

  function renderAccountOption(option: { value: string; label: string }) {
    const account = accounts?.find((a) => String(a.id) === option.value);
    const AccountIcon = resolveAccountIcon(account?.icon ?? null);
    const colorText = resolveAccountColorText(account?.color ?? null);
    const accountTypeOption = ACCOUNT_TYPE_OPTIONS.find(
      (opt) => opt.value === account?.account_type
    );
    return (
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <AccountIcon className={`size-4 shrink-0 ${colorText}`} />
          <span className="truncate">{option.label}</span>
        </span>
        {accountTypeOption && (
          <Badge
            variant="secondary"
            className={`shrink-0 ${accountTypeOption.badgeClassName}`}
          >
            {accountTypeOption.label}
          </Badge>
        )}
      </span>
    );
  }

  const categoryOptions =
    categories
      ?.filter((category) => category.type === type)
      .filter((category) => category.is_active || String(category.id) === categoryId)
      .map((category) => {
        const parentName = categories?.find(
          (parent) => parent.id === category.parent_id
        )?.name;
        return {
          value: String(category.id),
          label: parentName ? `${category.name} — ${parentName}` : category.name,
        };
      }) ?? [];

  return { accountOptions, categoryOptions, renderAccountOption };
}
