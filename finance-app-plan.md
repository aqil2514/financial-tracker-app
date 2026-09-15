# Rencana Aplikasi Keuangan + AI Assistant

## Konsep
Aplikasi pencatatan keuangan pribadi dengan AI assistant opsional.
- Data keuangan disimpan **lokal di device** (offline-first)
- AI assistant aktif **hanya saat online**, menggunakan API key milik user sendiri

---

## Fitur

### Core (Offline)
- Catat pemasukan & pengeluaran
- Kategori transaksi (makan, transport, belanja, dll)
- Ringkasan harian / mingguan / bulanan
- Grafik visualisasi pengeluaran

### AI Assistant (Online, opsional)
- User input API key sendiri (OpenAI / Gemini / Claude)
- Tanya jawab seputar kondisi keuangan user
- Analisis pola pengeluaran
- Saran penghematan berdasarkan data transaksi

---

## Tech Stack

| Kebutuhan | Teknologi |
|---|---|
| Framework | React Native + Expo |
| Routing | Expo Router |
| Penyimpanan lokal | expo-sqlite |
| Grafik | Victory Native / Gifted Charts |
| AI Integration | API key user (OpenAI / Gemini / Claude) |
| Build & Deploy | EAS Build (Expo) |

---

## Arsitektur Data (SQLite Lokal)

```sql
-- Tabel transaksi
transactions (
  id, type, amount, category, note, date, created_at
)

-- Tabel kategori
categories (
  id, name, icon, type
)

-- Tabel pengaturan
settings (
  key, value
)
```

---

## Alur Aplikasi

1. User catat transaksi → disimpan ke SQLite lokal
2. User buka laporan → data diambil dari lokal, tidak butuh internet
3. User tanya ke AI → app kirim ringkasan data + pertanyaan ke API (butuh internet)
4. AI jawab berdasarkan konteks keuangan user

---

## Struktur Folder (Expo Router)

```
app/
├── (tabs)/
│   ├── index.tsx          # Dashboard / ringkasan
│   ├── transactions.tsx   # Daftar transaksi
│   ├── reports.tsx        # Laporan & grafik
│   └── settings.tsx       # Pengaturan & API key
├── transaction/
│   ├── add.tsx            # Form tambah transaksi
│   └── [id].tsx           # Detail / edit transaksi
└── ai-chat.tsx            # AI assistant chat
```

---

## Monetisasi

### Model: Freemium Ringan
- **Gratis** → App penuh + tampil iklan (AdMob)
- **IAP sekali bayar** → Iklan hilang selamanya, semua fitur tetap sama

### Library
| Kebutuhan | Library |
|---|---|
| Iklan | `react-native-google-mobile-ads` (AdMob) |
| IAP | `react-native-iap` |
| Status premium | SQLite lokal (settings table) |

### Catatan
- AdMob gratis, butuh approval Google
- IAP sudah termasuk dalam akun Google Play Developer
- Harga IAP disarankan: Rp 15.000 – Rp 30.000 (sekali bayar)

---

## Operasional & Biaya

| Item | Biaya |
|---|---|
| Google Play Developer | $25 (sekali bayar) |
| Server / Hosting | $0 (data di device user) |
| Database server | $0 (SQLite lokal) |
| Biaya API AI | $0 (token milik user) |
| EAS Build | Free tier tersedia |

---

## Roadmap

### v1 — Core
- [ ] Setup project Expo + SQLite
- [ ] CRUD transaksi
- [ ] Kategori transaksi
- [ ] Dashboard ringkasan
- [ ] Laporan bulanan

### v2 — Polish
- [ ] Grafik visualisasi
- [ ] Export data (CSV)
- [ ] Dark mode
- [ ] Notifikasi pengingat

### v3 — AI
- [ ] Halaman input API key
- [ ] Integrasi AI assistant
- [ ] Analisis keuangan otomatis

### v4 — Monetisasi
- [ ] Setup AdMob & integrasi iklan (banner / interstitial)
- [ ] Setup IAP (produk "Hapus Iklan")
- [ ] Logika deteksi status premium
- [ ] Sembunyikan iklan untuk user premium

### v5 — Rilis
- [ ] Testing menyeluruh
- [ ] Store listing (screenshot, deskripsi, rating konten)
- [ ] Privacy policy (wajib untuk AdMob & Play Store)
- [ ] Build release & sign APK
- [ ] Submit ke Google Play
