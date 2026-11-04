# Unggah final bertahap — 4 November 2026

Status: implementasi dan pengujian otomatis selesai; uji Google Drive langsung
menunggu akses akun pengelola pada project staging sebelum deployment produksi.
PR: https://github.com/fathonydnm-byte/sistem-penomoran-otomatis/pull/9

## Perilaku

- PDF tetap maksimal 20 MiB. Browser memeriksa signature dan menghitung SHA-256,
  kemudian mengirim paket maksimal 1 MiB secara berurutan. Setiap pengguna hanya
  mempunyai satu RPC yang sedang ditunggu pada satu waktu.
- Progres mengukur jumlah byte yang dikonfirmasi Drive, bukan timer atau
  perkiraan. Setelah 100% diterima, tahap pemeriksaan dan pencatatan masih harus
  berhasil sebelum status menjadi lengkap. Waktu berjalan tetap ditampilkan.
- Kegagalan sementara dicoba ulang empat kali dengan backoff/jitter. Posisi
  Drive diperiksa jika respons sebelumnya hilang. ID file disediakan lebih awal
  sehingga respons paket terakhir yang hilang tidak membuat file ganda.
- Tombol Lanjutkan unggah mempertahankan token/posisi di memori halaman. File
  yang dipilih diperiksa ulang agar tidak tercampur dengan PDF lain. Jika file
  diganti, sesi lama ditutup dahulu. Tidak menyimpan PDF/token di localStorage.
- Melanjutkan otomatis/manual memerlukan halaman tetap terbuka. Memuat ulang
  atau menutup halaman akan kehilangan token browser; sesi server idle berakhir
  setelah 20 menit dan dibersihkan secara oportunistik. Tidak mengklaim resume
  lintas browser/perangkat atau ketahanan tanpa batas terhadap jaringan putus.

## Konsistensi dan privasi

Sesi disimpan dalam Script Properties privat, menggunakan token acak 128 bit,
binding ID permintaan/ukuran/hash dan lease 7 menit. Masa lease melebihi batas
eksekusi Apps Script 6 menit sehingga RPC lama tidak tumpang tindih dengan retry.
ScriptLock hanya dipakai untuk klaim/metadata/commit; tidak melingkupi transfer
Drive atau pembacaan PDF. Klaim ledger diperbarui setelah 5 menit aktivitas.
Maksimal 20 sesi aktif; ini bukan jaminan 20 eksekusi selalu tersedia.

Nomor yang sama tidak dapat diklaim dua sesi aktif, hash yang sama tidak dapat
dipakai untuk dua nomor, dan perubahan posisi baris diselesaikan kembali dengan
ID. Pembatalan/claim baru memblokir commit lama. SHA-256, ukuran, signature PDF,
keprivatan folder/file dan akses penggantian admin diperiksa saat finalisasi.
File lama hanya dipindahkan ke Trash setelah ledger baru tersimpan. File yang
gagal diverifikasi tidak ditandai lengkap. Endpoint unggah lama dipertahankan
untuk kompatibilitas halaman yang sudah terbuka ketika deployment berganti.

URL sesi resumable dan OAuth token tidak dikirim ke browser. Semua URL outbound
dibatasi ke Google Drive API dan berasal dari respons server Google. Fitur
mendeklarasikan advanced Drive v3; project default mengaktifkan API otomatis,
sedangkan project Cloud standar harus sudah mengaktifkan Drive API.

## Bukti dan batas pengujian

- 17 skenario server resumable: ack hilang, paket terputus/ulang/tidak berurutan,
  10 operasi saling berseling di luar lock, klaim ganda, integritas, pembatalan,
  penggantian admin gagal, 20 MiB, baris berpindah, klaim pengganti dan cleanup.
- 5 skenario browser-client: progres hanya setelah ack, finalisasi terpisah,
  retry, lanjutkan dengan token sama, ganti file, dan file tidak valid.
- Regresi 26 final surat, 21 generator, 12 reservasi, editor dan rilis produksi.
- Simulasi bukan uji beban Google langsung. Staging menyediakan tombol uji 10
  PDF buatan masing-masing 1,5 MiB, beserta pengukuran puncak eksekusi server.
  Hasil langsung belum dinyatakan lulus sampai tombol tersebut berhasil diuji.

Google membatasi eksekusi bersamaan per pengguna (30), waktu satu eksekusi
(6 menit), UrlFetch dan penyimpanan Properties. Web app execute-as-deployer
berbagi kuota pemilik dengan permintaan nomor dan pekerjaan lain; ketahanan
5–10 pengguna perlu mempertimbangkan beban aktual dan tidak dijamin absolut.

Rujukan primer:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/guides/services/advanced

## Isolasi pengujian dan rilis

Workflow chunk-staging hanya menargetkan project
1voCWP8UrNRyXNgCZPUaFkgmbZEKOzOZ1TodxLLuMb_kWT9BtxB5HiFlz (MYSELF).
Compiler menghapus konfigurasi produksi dan menambahkan panel/seed buatan hanya
ke source hasil kompilasi. Folder scripts dan .chunk-staging diabaikan clasp
produksi. Tidak menggabungkan ChunkStaging.js atau ChunkLoadTest.html ke live.
Uji penerimaan: progres bertahap, lanjutkan setelah putus, dua sesi nomor sama,
dua PDF bernomor berbeda, 10 unggahan serempak, final yang gagal tetap merah,
dan penggantian admin mempertahankan file lama saat gagal.

Rollback sebelum rilis ini: source 267e29e4082cdd5621aa91eff2124de16bf94ae8,
deployment versi 38. Ledger/PDF tetap dipertahankan. Tidak memulihkan salinan
spreadsheet di atas permintaan aktif. Sesi parsial akan kedaluwarsa; file yang
telah selesai tetap dapat dibaca melalui ledger yang sama.
