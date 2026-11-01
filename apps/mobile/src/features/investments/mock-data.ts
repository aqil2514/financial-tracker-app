// Data tiruan sementara untuk iterasi UI — diganti query SQLite begitu skema & logic investasi dikerjakan.
export type MockPurchase = {
  id: string;
  date: string;
  unit: number;
  pricePerUnit: number;
  amount: number;
  status: "pending" | "settled";
  isDirect: boolean;
};

export type MockSale = {
  id: string;
  date: string;
  unit: number;
  pricePerUnit: number;
  averageCost: number | null;
  realizedPl: number | null;
  status: "pending" | "settled";
  isWriteOff: boolean;
};

export type MockInvestmentAccount = {
  id: string;
  name: string;
  groupName: string | null;
  labels: string[];
  isActive: boolean;
  unitLabel: string;
  balance: number;
  currentMarketValue: number;
  marketValueUpdatedAt: string;
  purchases: MockPurchase[];
  sales: MockSale[];
};

export const MOCK_INVESTMENT_ACCOUNTS: MockInvestmentAccount[] = [
  {
    id: "inv-1",
    name: "Reksadana Pasar Uang",
    groupName: "Investasi",
    labels: ["Reksadana"],
    isActive: true,
    unitLabel: "unit",
    balance: 5_000_000,
    currentMarketValue: 5_120_000,
    marketValueUpdatedAt: "2026-10-30T08:00:00Z",
    purchases: [
      { id: "p-1", date: "2026-09-02", unit: 2_000, pricePerUnit: 1_250, amount: 2_500_000, status: "settled", isDirect: false },
      { id: "p-2", date: "2026-10-05", unit: 1_960, pricePerUnit: 1_275, amount: 2_500_000, status: "settled", isDirect: false },
    ],
    sales: [],
  },
  {
    id: "inv-2",
    name: "Saham BBCA",
    groupName: "Investasi",
    labels: ["Saham"],
    isActive: true,
    unitLabel: "lembar",
    balance: 8_000_000,
    currentMarketValue: 7_650_000,
    marketValueUpdatedAt: "2026-11-01T10:30:00Z",
    purchases: [
      { id: "p-3", date: "2026-08-12", unit: 100, pricePerUnit: 9_000, amount: 900_000, status: "settled", isDirect: true },
      { id: "p-4", date: "2026-09-20", unit: 800, pricePerUnit: 8_875, amount: 7_100_000, status: "settled", isDirect: false },
      { id: "p-5", date: "2026-11-01", unit: 100, pricePerUnit: 8_700, amount: 870_000, status: "pending", isDirect: false },
    ],
    sales: [
      { id: "s-1", date: "2026-10-15", unit: 200, pricePerUnit: 9_200, averageCost: 8_889, realizedPl: 62_200, status: "settled", isWriteOff: false },
      { id: "s-2", date: "2026-11-01", unit: 50, pricePerUnit: 8_800, averageCost: null, realizedPl: null, status: "pending", isWriteOff: false },
    ],
  },
  {
    id: "inv-3",
    name: "Emas Antam",
    groupName: null,
    labels: ["Emas", "Logam Mulia"],
    isActive: true,
    unitLabel: "gram",
    balance: 3_400_000,
    currentMarketValue: 3_700_000,
    marketValueUpdatedAt: "2026-09-12T09:00:00Z",
    purchases: [
      { id: "p-6", date: "2026-07-01", unit: 2, pricePerUnit: 1_700_000, amount: 3_400_000, status: "settled", isDirect: false },
    ],
    sales: [
      { id: "s-3", date: "2026-10-20", unit: 1, pricePerUnit: 0, averageCost: 1_700_000, realizedPl: -1_700_000, status: "settled", isWriteOff: true },
    ],
  },
];

export function findMockInvestmentAccount(id: string): MockInvestmentAccount | undefined {
  return MOCK_INVESTMENT_ACCOUNTS.find((account) => account.id === id);
}
