"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import CurrencyInput from "react-currency-input-field";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FormFieldCombobox,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { useInvestmentAccount } from "@/shared/investments/use-investment-account";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import type {
  SellInvestmentFormOutput,
  SellInvestmentFormValues,
} from "./schema";

const currencyInputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

type SellInvestmentFormProps = {
  form: UseFormReturn<
    SellInvestmentFormValues,
    unknown,
    SellInvestmentFormOutput
  >;
  onSubmit: (values: SellInvestmentFormOutput) => void;
  isPending: boolean;
  /** true kalau akun investasi sumber sudah terkunci dari konteks
   * pemanggil (lihat useCreateInvestmentSale) — pola PERSIS
   * new-investment-purchase-form.tsx. */
  investmentAccountLocked?: boolean;
};

export function SellInvestmentForm({
  form,
  onSubmit,
  isPending,
  investmentAccountLocked = false,
}: SellInvestmentFormProps) {
  const { data: accounts } = useAccounts();
  const investmentAccountId = form.watch("investment_account_id");
  const unit = form.watch("unit");
  const pricePerUnit = form.watch("price_per_unit");
  const status = form.watch("status");
  const isSettled = status === "settled";

  const { data: holding } = useInvestmentHoldingSummary(
    investmentAccountId ? String(investmentAccountId) : undefined,
  );
  const { data: investmentAccount } = useInvestmentAccount(
    investmentAccountId ? String(investmentAccountId) : undefined,
  );

  // "Harga Satuan Terkini" -- prefill dari current_market_value akun
  // (nilai TOTAL seluruh unit settled, BUKAN per-unit) dibagi remainingUnit
  // -- lihat investment-holding-math.ts (getRemainingUnit, HANYA settled,
  // TIDAK termasuk pending). Editable: user boleh override kalau mau pakai
  // harga lain dari harga pasar acuan. State lokal terpisah dari form
  // resmi (TIDAK masuk sellInvestmentSchema) -- tapi NILAINYA disinkronkan
  // ke field form `price_per_unit` lewat useEffect di bawah, karena field
  // ini MENGGANTIKAN PricePerUnitField lama (satu-satunya input harga jual
  // per unit yang sebenarnya tersimpan ke investment_sales.price_per_unit).
  const marketPricePerUnit =
    investmentAccount && holding && holding.remainingUnit > 0
      ? investmentAccount.current_market_value / holding.remainingUnit
      : null;
  const [currentPriceDisplay, setCurrentPriceDisplay] = useState<number | null | undefined>(undefined);
  const currentPrice = currentPriceDisplay !== undefined ? currentPriceDisplay : marketPricePerUnit;

  // Sinkronkan Harga Satuan Terkini ke field form resmi `price_per_unit`
  // -- field UI lama (PricePerUnitField) yang dulu menulis ke sini sudah
  // dihapus dari form ini, "Harga Satuan Terkini" sekarang satu-satunya
  // sumber nilai harga jual per unit yang disubmit. shouldDirty: false --
  // ini sinkronisasi otomatis dari sistem, BUKAN input user langsung ke
  // field unit, tidak perlu menandai form "dirty" karenanya.
  useEffect(() => {
    form.setValue("price_per_unit", (currentPrice ?? null) as never, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaksi ke currentPrice saja, form stabil dari closure
  }, [currentPrice]);

  // Mode Otomatis (default): Unit & Harga Total saling sinkron lewat
  // persentase (lihat applyPercentage di bawah) -- cocok utk cepat
  // menentukan kira-kira berapa unit/nominal dari harga pasar acuan.
  // Mode Manual: Unit & Harga Total jadi INDEPENDEN (edit satu tidak
  // mempengaruhi yang lain) -- utk koreksi presisi begitu user sadar ada
  // yang meleset dari aplikasi investasi aslinya (platform sungguhan
  // belum tentu sama persis dengan harga pasar acuan di sini).
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // Persentase (0-1) dari remainingUnit -- SUMBER KEBENARAN Harga Total di
  // mode Otomatis, menjembatani Unit <-> Harga Total (BUKAN unit/hargaTotal
  // itu sendiri). Alasan dipisah jadi state sendiri (bukan di-derive ulang
  // dari unit form tiap render): begitu Harga Satuan Terkini berubah,
  // persentase HARUS tetap sama (anchor) supaya Unit tidak ikut bergeser.
  // Null = belum pernah diisi sama sekali.
  const [percentage, setPercentage] = useState<number | null>(null);
  // Nominal Harga Total di mode MANUAL -- state independen terpisah dari
  // percentage, TIDAK dihitung dari Unit sama sekali (beda dari mode
  // Otomatis). Dipertahankan terpisah (bukan "cuma 1 state totalPrice")
  // supaya pindah mode Otomatis -> Manual -> Otomatis tidak saling
  // menimpa nilai satu sama lain secara tidak sengaja.
  const [totalPriceManual, setTotalPriceManual] = useState<number | null>(null);

  const remainingUnit = holding?.remainingUnit ?? 0;
  // Nilai pasar SELURUH unit settled SAAT INI -- current_market_value kalau
  // user belum override Harga Satuan Terkini, atau dihitung ulang dari
  // currentPrice x remainingUnit kalau sudah di-override (supaya batas
  // atas slider & hasil Harga Total konsisten dgn harga yang SEDANG dipakai,
  // bukan harga lama dari field yang sudah diedit).
  const totalMarketValueAtCurrentPrice = currentPrice != null ? currentPrice * remainingUnit : 0;
  const totalPrice =
    mode === "auto"
      ? percentage != null
        ? percentage * totalMarketValueAtCurrentPrice
        : null
      : totalPriceManual;

  // Begitu percentage (sumber kebenaran mode Otomatis) berubah -- lewat
  // slider/field Unit ATAU slider/field Harga Total -- Unit form WAJIB
  // disinkronkan balik, sama-sama berbasis currentPrice yang SEDANG
  // berlaku. HANYA dipakai di mode Otomatis.
  function applyPercentage(next: number) {
    const clamped = Math.min(Math.max(next, 0), 1);
    setPercentage(clamped);
    if (remainingUnit > 0) {
      form.setValue("unit", (clamped * remainingUnit) as never, { shouldValidate: true, shouldDirty: true });
    }
  }

  // Unit diubah (field/slider) -- mode Otomatis: via persentase (Harga
  // Total ikut). Mode Manual: LANGSUNG ke form, Harga Total TIDAK disentuh
  // sama sekali (dua field independen, perilaku form sebelum ada sinkron).
  function handleUnitChange(nextUnit: number) {
    if (mode === "auto") {
      applyPercentage(remainingUnit > 0 ? nextUnit / remainingUnit : 0);
      return;
    }
    form.setValue("unit", nextUnit as never, { shouldValidate: true, shouldDirty: true });
  }

  // Harga Total diubah (field/slider) -- mode Otomatis: via persentase
  // (Unit ikut). Mode Manual: LANGSUNG ke totalPriceManual, Unit TIDAK
  // disentuh sama sekali.
  function handleTotalPriceChange(nextTotal: number) {
    if (mode === "auto") {
      applyPercentage(totalMarketValueAtCurrentPrice > 0 ? nextTotal / totalMarketValueAtCurrentPrice : 0);
      return;
    }
    setTotalPriceManual(nextTotal);
  }

  // "Jual Semua Unit" -- derived dari field unit itu sendiri (BUKAN state
  // terpisah yang bisa desync), supaya tidak ada bug "checkbox dicentang
  // tapi unit sudah diubah manual lagi tanpa ke-uncheck otomatis". Dicek
  // SAMA PERSIS (===), bukan toleransi epsilon -- holding.remainingUnit
  // di-setValue LANGSUNG sebagai number JS presisi penuh (bukan lewat
  // CurrencyInput yang decimalsLimit={4}, lihat unit-amount-field.tsx),
  // jadi perbandingan exact aman selama field tidak diubah manual sesudahnya.
  const isSellingAll =
    holding != null && holding.remainingUnit > 0 && Number(unit) === holding.remainingUnit;

  const cashAccountOptions =
    accounts
      ?.filter(
        (account) => account.account_type === "cash" && account.is_active,
      )
      .map((account) => ({
        value: String(account.id),
        label: account.group_name
          ? `${account.name} — ${account.group_name}`
          : account.name,
      })) ?? [];

  const investmentAccountOptions =
    accounts
      ?.filter(
        (account) => account.account_type === "investment" && account.is_active,
      )
      .map((account) => ({
        value: String(account.id),
        label: account.group_name
          ? `${account.name} — ${account.group_name}`
          : account.name,
      })) ?? [];

  // Nominal transfer (uang yang BENAR-benar masuk ke kas) = unit * harga
  // jual per unit, dihitung otomatis -- lihat schema.ts + komentar di
  // use-create-investment-sale.ts soal kenapa field ini read-only (bukan
  // manual seperti form beli): balance akun investment harus berkurang
  // sebesar average cost (bukan nominal ini), jadi field ini MURNI
  // informasi "uang yang akan diterima", tidak pernah jadi sumber
  // kebenaran utk balance yang disimpan ke transactions.amount.
  const displayAmount =
    unit && pricePerUnit ? Number(unit) * Number(pricePerUnit) : 0;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText
          form={form}
          name="note"
          label="Catatan"
          placeholder="Mis. Jual sebagian reksadana"
        />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      <FormFieldToggleGroup
        form={form}
        name="status"
        label="Status"
        description={
          isSettled
            ? "Nilainya sudah pasti saat ini."
            : "Order masih diproses -- unit sudah dikurangi dari saldo sekarang (optimis), bisa diubah ke Settled belakangan."
        }
        options={[
          { value: "pending", label: "Pending" },
          { value: "settled", label: "Settled" },
        ]}
      />
      <div
        className={
          investmentAccountLocked && !isSettled ? "" : "grid grid-cols-2 gap-4"
        }
      >
        {!investmentAccountLocked && (
          <FormFieldCombobox
            form={form}
            name="investment_account_id"
            label="Akun Investasi"
            placeholder="Cari akun investasi..."
            options={investmentAccountOptions}
          />
        )}
        {isSettled && (
          <div className="col-span-2">
            <FormFieldCombobox
              form={form}
              name="cash_account_id"
              label="Akun Kas"
              placeholder="Cari akun kas..."
              options={cashAccountOptions}
            />
          </div>
        )}
      </div>
      {holding && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
          <p>
            Sisa unit:{" "}
            <span className="font-medium">{holding.remainingUnit}</span>
          </p>
          <p>
            Avg. cost/unit:{" "}
            <span className="font-medium">
              {formatCurrency(holding.averageCostPerUnit, "IDR")}
            </span>
          </p>
        </div>
      )}
      {holding && holding.remainingUnit > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isSellingAll}
            onCheckedChange={(checked) => {
              // setValue dengan number ASLI dari query (bukan diketik ulang
              // lewat CurrencyInput yang decimalsLimit={4}) -- menghindari
              // sisa unit presisi tinggi (mis. 99.99999999994 akibat
              // akumulasi pembagian average cost) terpotong jadi 4 desimal
              // lalu dianggap BEDA dari remainingUnit asli saat validasi
              // oversell (getRemainingUnit, investment-holding-math.ts).
              // Uncheck -> kosongkan lagi (bukan dibiarkan terkunci ke
              // remainingUnit) supaya user bisa ketik manual lagi, field
              // unit otomatis ikut ENABLED lagi (isSellingAll jadi false).
              form.setValue("unit", (checked ? holding.remainingUnit : null) as never, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          Jual Semua Unit ({holding.remainingUnit})
        </label>
      )}
      {/* Mode Otomatis: persentase (dari remainingUnit) jadi sumber
          kebenaran yang menjembatani Unit <-> Harga Total -- geser/ketik
          salah satu, yang lain ikut menyesuaikan. Mode Manual: keduanya
          independen (perilaku form sebelum ada sinkron) -- utk koreksi
          presisi begitu ada yang meleset dari aplikasi investasi aslinya.
          Mengubah Harga Satuan Terkini TIDAK PERNAH mengubah Unit, cuma
          Harga Total (mode Otomatis) yang ikut dihitung ulang. Menggantikan
          toggle Satuan/Total lama (PricePerUnitField) khusus di form Jual
          Investasi ini -- komponen itu TETAP dipakai apa adanya di form
          lain (Catat Pembelian, edit transaksi, dst). */}
      <div className="flex items-center justify-between gap-4">
        <Label>Mode Perhitungan</Label>
        <ToggleGroup
          value={[mode]}
          onValueChange={(values: string[]) => {
            if (values.length === 0) return;
            const nextMode = values[values.length - 1] as "auto" | "manual";
            // Pindah Otomatis -> Manual: bawa nilai Harga Total TERAKHIR
            // dari mode Otomatis sebagai titik awal manual (bukan reset ke
            // kosong) -- Unit TIDAK perlu disentuh, field itu sudah sama
            // di form terlepas dari mode mana yang aktif.
            if (nextMode === "manual" && mode === "auto") {
              setTotalPriceManual(totalPrice);
            }
            setMode(nextMode);
          }}
          size="sm"
        >
          <ToggleGroupItem value="auto">Otomatis</ToggleGroupItem>
          <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="current_price_per_unit">Harga Satuan Terkini</Label>
        <CurrencyInput
          id="current_price_per_unit"
          value={currentPrice ?? ""}
          onValueChange={(_raw, _name, values) => setCurrentPriceDisplay(values?.float ?? null)}
          placeholder="Harga pasar per unit"
          prefix="Rp "
          decimalsLimit={2}
          groupSeparator="."
          decimalSeparator=","
          className={currencyInputClassName}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <UnitAmountField form={form} name="unit" optional={false} disabled={isSellingAll} />
          <Slider
            min={0}
            max={remainingUnit > 0 ? remainingUnit : 1}
            step={0.0001}
            value={[Number(unit) || 0]}
            disabled={isSellingAll || remainingUnit <= 0}
            onValueChange={(next) => {
              const nextUnit = Array.isArray(next) ? next[0] : next;
              handleUnitChange(nextUnit);
            }}
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="total_price">Harga Total</Label>
            <CurrencyInput
              id="total_price"
              value={totalPrice ?? ""}
              onValueChange={(_raw, _name, values) => handleTotalPriceChange(values?.float ?? 0)}
              placeholder="Nominal total jual"
              prefix="Rp "
              decimalsLimit={2}
              groupSeparator="."
              decimalSeparator=","
              className={currencyInputClassName}
            />
          </div>
          <Slider
            min={0}
            max={totalMarketValueAtCurrentPrice > 0 ? totalMarketValueAtCurrentPrice : 1}
            step={1000}
            value={[totalPrice ?? 0]}
            disabled={mode === "auto" && totalMarketValueAtCurrentPrice <= 0}
            onValueChange={(next) => {
              const nextValue = Array.isArray(next) ? next[0] : next;
              handleTotalPriceChange(nextValue);
            }}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Nominal yang masuk ke akun kas:{" "}
        <span className="font-medium">
          {formatCurrency(displayAmount, "IDR")}
        </span>{" "}
        (otomatis dari unit × harga jual).
      </p>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
