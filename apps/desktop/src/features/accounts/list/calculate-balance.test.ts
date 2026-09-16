import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "@/lib/db";
import { calculateAccountBalance, withBalances } from "./calculate-balance";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: "Tunai",
    icon: null,
    initial_balance: 0,
    group_id: null,
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    type: "income",
    amount: 0,
    category_id: null,
    account_id: null,
    transfer_account_id: null,
    note: null,
    date: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calculateAccountBalance", () => {
  it("returns initial_balance when there are no transactions", () => {
    const account = makeAccount({ initial_balance: 100_000 });
    expect(calculateAccountBalance(account, [])).toBe(100_000);
  });

  it("adds income transactions for the account", () => {
    const account = makeAccount({ id: 1, initial_balance: 0 });
    const transactions = [
      makeTransaction({ type: "income", amount: 50_000, account_id: 1 }),
    ];
    expect(calculateAccountBalance(account, transactions)).toBe(50_000);
  });

  it("subtracts expense transactions for the account", () => {
    const account = makeAccount({ id: 1, initial_balance: 100_000 });
    const transactions = [
      makeTransaction({ type: "expense", amount: 30_000, account_id: 1 }),
    ];
    expect(calculateAccountBalance(account, transactions)).toBe(70_000);
  });

  it("subtracts transfer amount from the source account", () => {
    const account = makeAccount({ id: 1, initial_balance: 100_000 });
    const transactions = [
      makeTransaction({
        type: "transfer",
        amount: 20_000,
        account_id: 1,
        transfer_account_id: 2,
      }),
    ];
    expect(calculateAccountBalance(account, transactions)).toBe(80_000);
  });

  it("adds transfer amount to the destination account", () => {
    const account = makeAccount({ id: 2, initial_balance: 0 });
    const transactions = [
      makeTransaction({
        type: "transfer",
        amount: 20_000,
        account_id: 1,
        transfer_account_id: 2,
      }),
    ];
    expect(calculateAccountBalance(account, transactions)).toBe(20_000);
  });

  it("ignores transactions belonging to other accounts", () => {
    const account = makeAccount({ id: 1, initial_balance: 50_000 });
    const transactions = [
      makeTransaction({ type: "expense", amount: 10_000, account_id: 2 }),
    ];
    expect(calculateAccountBalance(account, transactions)).toBe(50_000);
  });
});

describe("withBalances", () => {
  it("attaches a computed balance to every account", () => {
    const accounts = [
      makeAccount({ id: 1, initial_balance: 100_000 }),
      makeAccount({ id: 2, initial_balance: 0 }),
    ];
    const transactions = [
      makeTransaction({ type: "expense", amount: 25_000, account_id: 1 }),
      makeTransaction({ type: "income", amount: 10_000, account_id: 2 }),
    ];

    const result = withBalances(accounts, transactions);

    expect(result).toEqual([
      { ...accounts[0], balance: 75_000, group_name: null },
      { ...accounts[1], balance: 10_000, group_name: null },
    ]);
  });

  it("attaches the matching group name when groups are provided", () => {
    const accounts = [
      makeAccount({ id: 1, initial_balance: 0, group_id: 2 }),
    ];
    const groups = [
      { id: 1, name: "Bank", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, name: "E-Wallet", created_at: "2026-01-01T00:00:00Z" },
    ];

    const result = withBalances(accounts, [], groups);

    expect(result[0].group_name).toBe("E-Wallet");
  });
});
