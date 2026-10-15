# Dompetku v3.7.3 — BTC Fix (multi-CDN)

Web3 wallet + Go Work + Chat World + Marketplace + Go Drive + **Bitcoin non-custodial**.

## Perbaikan v3.7.3 (BTC)
- **BTC tidak lagi stuck “Modul sedang dimuat”**
- Library crypto dimuat **dinamis** dengan fallback multi-CDN:
  1. esm.sh
  2. jsDelivr (`/+esm`)
  3. unpkg (`?module`)
- `btc.js` sekarang **script klasik** (bukan `type="module"`), jadi API `window.DKBTC` langsung tersedia
- Saat buka dompet: status “Memuat library…” + tombol **Coba Lagi** jika CDN gagal
- Preload library di background agar buka BTC lebih cepat
- API blockchain tetap: **Blockstream Esplora** (saldo, UTXO, fee, broadcast) + **CoinGecko** (kurs fiat)

## Cara pakai
1. Extract semua file ke folder yang sama
2. Buka `index.html` (atau deploy ke GitHub Pages)
3. **Hard refresh** (`Ctrl+Shift+R` / hapus cache)
4. Login → tekan tombol **BTC** di header
5. Buat / buka dompet dengan kata sandi ≥ 10 karakter
6. Catat recovery phrase offline

## Catatan jujur
- Dompet BTC **non-custodial**: private key terenkripsi di perangkat Anda (PBKDF2 + AES-GCM)
- Butuh koneksi internet untuk memuat library crypto dan data blockchain
- Di jaringan ketat / offline, CDN bisa gagal — gunakan tombol **Coba Lagi** atau ganti jaringan
- Transfer BTC nyata ke alamat mainnet; uji dengan jumlah kecil dulu
