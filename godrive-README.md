# Go Drive — add-on Dompetku

## Isi
- `godrive.js` — modul Go Drive (tombol, tampilan kaca transparan, logika order, escrow, rating).

## Cara pasang
1. Salin `godrive.js` ke folder yang sama dengan `index.html`.
2. Di `index.html`, tambahkan baris ini tepat setelah `marketplace.js`:

   ```html
   <script src="godrive.js?v=562"></script>
   ```

3. Naikkan `?v=` pada semua `<script>` dan `<link>` (misalnya `561` → `562`) supaya cache browser diperbarui.
4. Hard refresh (Ctrl+Shift+R) atau hapus cache.

Tidak perlu mengubah `app.js`, `chat_v2.js`, atau `style.css`. Modul ini memakai fungsi yang sudah ada:
- `dkGetBalance`, `dkUpdateBalance`, `dkAddTx`, `dkFmtMoney` dari `app.js`
- `dkChatOpen`, `dkChatOpenRoom` dari `chat_v2.js`

## Alur
- **Penumpang**: pilih layanan (jemput orang / antar makanan-barang), pilih motor atau mobil, ketuk peta untuk titik jemput lalu tujuan, isi patokan, tawaran nego (opsional), kirim.
- **Driver**: tekan Online, pilih motor atau mobil, lalu Terima atau Tawar balik.
- **Escrow**: saat order diterima, saldo penumpang ditahan. Driver menekan "Mulai jalan", lalu "Sampai/selesai". Dana dilepas ke driver hanya setelah penumpang menekan "Konfirmasi selesai". Pembatalan sebelum jalan mengembalikan saldo.
- **Tarif**: Rp 3.000/km × jarak (dibulatkan ke 0,1 km), atau harga nego.
- **Rating**: penumpang memberi bintang 1–5 sekali saja, setelah pesanan selesai.

## Catatan jujur
- Semua data disimpan di `localStorage` perangkat, sama seperti modul lain di Dompetku. Driver dan penumpang di HP berbeda **tidak** akan saling terlihat sampai ada backend.
- Escrow di sini hanya simulasi di sisi klien. Untuk uang sungguhan, saldo tertahan dan status order harus dikelola server.
- Peta memakai OpenStreetMap (Leaflet). Google Maps embed butuh API key berbayar, jadi tombol "Buka rute di Google Maps" hanya membuka link rute.
- Jarak memakai OSRM (server publik). Jika gagal, dipakai garis lurus × 1,3.
