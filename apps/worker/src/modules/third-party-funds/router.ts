import { Hono } from "hono";
import type { AppContext } from "../../shared/auth";
import { requireAuth } from "../../shared/auth";
import {
  handlePostThirdPartyFundPush,
  handleDeleteThirdPartyFundPush,
  handlePostThirdPartyFundDirect,
} from "./controller";

// Modul ini TANPA status pending/settled (beda dari investments/) --
// sisa titipan selalu dihitung ulang dari SUM, jadi cuma butuh endpoint
// push (upsert-by-id) + delete + direct, sejajar pola /debts/push tapi
// lebih sederhana (tidak ada /write-off, /correct-balance, dst -- lihat
// docs/todos/plan/third-party-sync.md Tahap 4 utk rencana koreksi
// saldo granular, BELUM dikerjakan).
//
// Titip/ambil langsung (dari DESKTOP) DAN transfer third_party->third_party
// KEDUANYA dipicu dari transactions/service.ts (createTransactionRow/
// updateTransactionRow, applyDirectThirdPartyTransaction) -- BUKAN
// endpoint router ini, pola PERSIS applyDebtTransaction/applyInvestmentTransaction
// (modul ini PEMILIK logic, transactions/service.ts PEMICU).
//
// Endpoint /direct (ditambahkan Tahap 4) BEDA -- titip/ambil langsung
// dipicu dari MCP TANPA harus lewat desktop sama sekali, pola PERSIS
// POST /debts (createDirectDebt) & POST /investments/purchases/direct.
export const thirdPartyFundsRouter = new Hono<AppContext>();

thirdPartyFundsRouter.use(requireAuth);
thirdPartyFundsRouter.post("/push", handlePostThirdPartyFundPush);
thirdPartyFundsRouter.delete("/push/:id", handleDeleteThirdPartyFundPush);
thirdPartyFundsRouter.post("/direct", handlePostThirdPartyFundDirect);
