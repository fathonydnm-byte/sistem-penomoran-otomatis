# Pelengkapan Surat Final SIDDIQ

Catatan historis prototipe UAT pada branch `feature/pelengkapan-surat-final`.
Prototipe dan fixture tetap khusus uji. Sejak 4 November 2026, implementasi
produksi memakai ledger dan folder privat yang dikonfigurasi lewat Script
Properties. Lihat [rilis produksi](rilis-final-surat-20261104.md) serta
[handover terbaru](../HANDOVER_SISTEM_PENOMORAN_OTOMATIS.md) untuk staging
aktif, konfigurasi saat ini, dan alur unggah bertahap.

## Keputusan produk

- Menu Lengkapi Surat Final menampilkan pilihan seluruh nama yang ada; nama
  panggilan tidak digabung otomatis. Seseorang boleh melengkapi nomor orang lain.
- Riwayat publik hanya berisi jenis, nomor, tanggal surat, pengajuan aktual,
  kelengkapan, dan tindakan unggah. ID permintaan digunakan sebagai pengikat
  internal. Perihal, unit, draft, token lama, dan tautan final tidak dikirim.
- Cakupan awal seluruh `PERMINTAAN`, tanpa impor arsip lama dan tanpa tanggal
  awal hard-coded. SD, ND, SK/SE, massal dan mundur termasuk. DIBATALKAN,
  SLOT_TERSEDIA, placeholder Slot Kosong, dan kegagalan alokasi tidak dihitung.
- Satu PDF per nomor, maksimal 20 MiB. Ekstensi serta signature PDF diperiksa
  di server. Hash yang sama pada nomor berbeda ditolak, termasuk klaim bersamaan.
- Lengkap setelah penyimpanan Drive dan ledger berhasil; tanpa verifikasi,
  keterlambatan, pengingat, atau pencatatan identitas pengunggah publik.
- Pemohon tidak dapat mengganti final. Retry file identik bersifat idempotent.
  Admin boleh unggah/ganti/lepas tautan melalui sesi kode massal yang sah.
- Penggantian mempertahankan satu file aktif. File lama dipindah ke Trash setelah
  ledger baru berhasil ditulis; tidak ada tampilan riwayat versi. Tidak melakukan
  penghapusan permanen. Audit tindakan admin tetap dicatat.
- Folder final privat diperiksa di server; masing-masing subfolder juga diperiksa.
  URL Drive hanya tersedia melalui respons admin, dengan izin file tetap privat.
- Draft dan status permintaan lama tidak diubah.

## Lingkungan uji

Manifest `MYSELF` memastikan hanya akun deployer dapat membuka web app UJI.
Kode akses admin dummy: `UJI-SIDDIQ-2026` (bukan kode produksi).
Guard menolak ID project produksi. ID spreadsheet dan root produksi dihapus
dari konfigurasi branch ini; `.clasp.json` source sengaja tidak memiliki target.
Workflow produksi yang sudah ada tetap tidak menerima branch pengembangan.

Workflow `.github/workflows/final-staging.yml` menjalankan tes, membuat project
Apps Script terpisah dengan kredensial pengelola yang sudah tersimpan, dan
menyinkronkan source hanya ke target UJI. Target disimpan di cache Actions.
Deployment baru hanya berlaku untuk project UJI dan aksesnya `MYSELF`.
URL terbaru dapat dilihat pada log/artifact `siddiq-final-staging-target`.

Saat pertama membuka aplikasi, akun pengelola mungkin perlu memberi otorisasi
Google. Hanya setelah otorisasi itu, bootstrap membuat spreadsheet dan folder
privat baru bernama SIDDIQ UJI FINAL SURAT — DATA BUATAN, lalu mengisi enam
fixture. Bootstrap idempotent dan tidak memasang trigger arsip atau email.
Tidak diperlukan perubahan izin folder produksi.

Jika Apps Script API/kredensial menolak pembuatan project, jangan memakai target
produksi sebagai fallback. Simpan hasil tes dan lanjutkan melalui project UJI
yang dibuat pemilik secara manual.

## Struktur ledger dan konkurensi

Sheet `SURAT_FINAL`: ID permintaan, ID file, nama, ukuran, waktu unggah/update,
hash PDF, ID klaim, akhir klaim, versi, dan pesan kegagalan generik.
Sheet `LOG_SURAT_FINAL`: waktu, ID permintaan, tindakan, alasan.
Setting `FINAL_ROOT_FOLDER_ID` menunjuk folder khusus final privat.

Klaim dan commit memakai ScriptLock; operasi Drive berlangsung di luar lock.
Klaim kedaluwarsa setelah 20 menit. Commit memeriksa ulang ID klaim dan status
permintaan. Upload gagal melepas klaim dan mempertahankan final lama jika ada.
Pembatalan permintaan ketika file sedang dibuat tidak menghasilkan final lengkap.

## Monitoring dan ekspor

Menu admin memakai gerbang yang sama dengan mode massal dan menyediakan tab
Monitoring Surat Final. Filter: nama, unit, jenis, status, tahun surat dan periode
waktu pengajuan aktual. Daftar detail dipaginasi 50 baris; ringkasan dihitung
atas seluruh hasil filter, bukan hanya halaman yang tampil.

Ekspor PDF dan XLSX memuat ringkasan per pemohon: total wajib, sudah, belum,
persentase. Judul, filter/periode dan waktu cetak WIB ditampilkan tanpa kop.
Laporan dibangun sebagai spreadsheet sementara, diekspor, lalu file sementara
dipindah ke Trash. Format ekspor diperiksa dan nama pemohon ditulis sebagai teks
untuk mencegah formula spreadsheet dari input nama. Maksimal 2.000 pemohon dan
10 MiB hasil ekspor per unduhan. Persempit filter jika batas tersebut terlampaui.

## Urutan uji penerimaan oleh pemilik

1. Buka URL UJI dengan akun pengelola; setujui otorisasi hanya untuk project UJI.
   Pastikan banner DATA BUATAN terlihat.
2. Unduh PDF Dummy A dan B dari halaman. Kedua file berbeda dan tidak berisi data asli.
3. Buka Lengkapi Surat Final. Pilih Pemohon Uji Satu, Uji Satu (nama panggilan),
   lalu Pemohon Uji Dua. Pastikan perihal/draft tidak terlihat.
4. Pastikan nomor dibatalkan dan slot tersedia tidak muncul dalam kewajiban.
5. Unggah Dummy A ke salah satu nomor. Status berubah hijau setelah berhasil.
6. Buka ulang daftar; pastikan tidak ada tombol penggantian untuk publik.
7. Coba Dummy A pada nomor berbeda. Sistem harus menolak file yang sama.
8. Unggah Dummy B pada nama panggilan yang draft-nya gagal. Final tetap dapat lengkap.
9. Buka gerbang kode admin melalui titik pada footer. Masukkan UJI-SIDDIQ-2026.
   Pilih Monitoring Surat Final.
10. Filter pemohon dan status. Cocokkan hitungan dengan hasil unggah. Uji tanggal
    pengajuan aktual yang berbeda dari tanggal surat mundur.
11. Buka tautan final sebagai admin. File harus tetap privat di Drive, tanpa
    izin Anyone. Jangan membagikan file dummy maupun link final ke publik.
12. Ganti final melalui admin dengan PDF berbeda; periksa file aktif terbaru.
    Batalkan unggahan dengan alasan; pastikan indikator kembali merah.
13. Unduh PDF dan Excel untuk semua pemohon serta satu pemohon. Cocokkan total,
    periode, tanggal cetak dan persentase. Periksa PDF tidak terpotong.
14. Coba ekstensi bukan PDF, PDF palsu, dan file lebih dari 20 MiB; harus ditolak.
15. Catat hasil per langkah, nama fixture/nomor dan pesan error bila ada. Setelah
    seluruh hasil diterima, barulah susun PR rilis terpisah atas instruksi pemilik.

## Pengujian otomatis

### Penyempurnaan 4 November 2026

- Bantuan kecil di halaman depan menyandingkan Template resmi UINSA dan
  Rekomendasi kode surat. Satu dialog dipakai bersama agar master kode tidak
  dimuat dua kali dan formulir utama tetap ringkas. Dari halaman depan, isi
  nomor yang sudah diperoleh, pilih SD/ND dan bulan; tahun otomatis WIB.
  Dari hasil permintaan, nomor/tahun tetap terikat ke hasil dan tidak dapat
  diubah. SK/SE tetap tidak memperoleh tawaran kode setelah permintaan.
- Setelah unggah publik berhasil, indikator diperbarui dari respons server
  tanpa memuat ulang daftar publik maupun monitoring admin yang tersembunyi.
  Monitoring tetap mengambil data terkini saat tab dibuka atau filter diterapkan.
- Commit unggah memeriksa ulang baris permintaan dan klaim yang bersangkutan.
  Jika baris berpindah, pencarian kembali memakai ID. Pemeriksaan pembatalan,
  klaim bersamaan dan akses privat tetap berlaku. Penamaan file dilakukan
  pada blob sehingga tidak membutuhkan operasi rename Drive tambahan.
- Pembacaan konfigurasi project UJI dilakukan ketika koneksi spreadsheet
  dibuka, bukan diulang untuk setiap pengambilan sheet dalam eksekusi yang sama.
- Uji deterministik 1.002 permintaan dan 1.000 baris ledger: sel yang dibaca
  turun dari 64.105 menjadi 32.084 (sekitar 50%), getLastRow dari 10 menjadi 3,
  dan lookup sheet dari 9 menjadi 6. Ini ukuran pekerjaan, bukan klaim durasi
  unggah nyata; transfer file dan latensi Google masih perlu diukur.

Uji tambahan: buka rekomendasi dari halaman depan, isi nomor yang sudah ada,
susun kode dan tutup dialog. Setelah permintaan SD/ND berhasil, buka generator
di hasilnya dan pastikan nomor otomatis tetap benar. Ulangi pada layar HP dan
desktop; dialog tertutup tidak boleh menambah tinggi area bantuan.
Untuk membandingkan kecepatan unggah, gunakan ukuran PDF dan koneksi yang sama
serta nomor uji yang belum lengkap. Catat waktu sejak klik unggah sampai status
berubah hijau; uji setidaknya tiga kali karena latensi Google dapat berubah.

```bash
node tests/reservations.cjs
node tests/admin-edit.cjs
node tests/letter-codes.cjs
node tests/final-letters.cjs
node tests/staging-isolation.cjs
git diff --check
```

Pengujian lokal memvalidasi logika, privasi respons, konkurensi dan isolasi.
Pengujian itu tidak menggantikan uji unggah, otorisasi, rendering PDF/XLSX, serta
akses file nyata melalui URL UJI. Hasil uji penerimaan harus dicatat sebelum rilis.

## Catatan untuk rilis berikutnya

Jangan menggabungkan Staging.js, banner/dummy UI, manifest MYSELF, bootstrap,
konfigurasi target kosong, atau workflow UJI ke produksi begitu saja. Rilis harus
memiliki PR tersendiri, backup dan migrasi idempotent dua sheet final, setting
folder privat, pemeriksaan perizinan serta rencana rollback. Arsip tahunan di
produksi perlu diputuskan kembali sebelum tahun berganti agar kewajiban final
yang belum selesai tidak menghilang saat baris dipindahkan ke arsip.
