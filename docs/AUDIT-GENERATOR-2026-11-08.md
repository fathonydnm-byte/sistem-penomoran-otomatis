# Audit generator surat dan penomoran — 8 November 2026

## Ruang lingkup dan cara uji

Review rinci `LetterDrafts.js`, `LetterDraftsUI.html`, jalur reservasi/upload di `Code.js`, `Reservations.js`, serta interaksi dengan penyimpanan privat dan edit admin. Pemeriksaan parsing seluruh modul server/client dan deklarasi fungsi ganda. Regresi modul penomoran, edit admin, rekomendasi kode, pelengkapan final, upload resumable, dan isolasi produksi.

Uji beban menggunakan deployment Apps Script **khusus uji**, melalui browser dan `google.script.run`. Setiap gelombang membuat Google Docs dari template, mengajukan nomor bersamaan, mengulang token, lalu membaca register, isi Google Docs, dan metadata PDF untuk memeriksa hasil. Meter server mengukur eksekusi tumpang tindih, bukan hanya jumlah Promise browser. Data permintaan fiktif, master/template resmi hanya dibaca. Nomor produksi tidak digunakan. Ini simulasi klien paralel melalui satu browser, bukan 10 akun manusia berbeda.

## Temuan dan perbaikan

1. **Status draf tumbuh tanpa batas di Script Properties.** Pindah ke `GENERATOR_JOBS` pada ledger privat yang sudah digunakan sistem. Catatan lama tetap terbaca sebagai fallback dan tidak dihapus. Perubahan tidak memodifikasi master pejabat atau format register permintaan.
2. **Status untuk daftar penerima panjang tersimpan berulang.** Simpan data pemohon/unit saja pada checkpoint pengajuan, gunakan kembali metadata surat. Ledger mampu menyimpan status lebih besar dari batas 9 KB properti.
3. **Tujuan undangan terpotong 300 karakter di register dan editor admin.** Samakan batas 6.000 karakter untuk tujuan pada jalur tersebut, dengan batas jumlah penerima generator tetap 30. Tambah tes agar edit kolom lain tidak memotong penerima.
4. **Kegagalan checkpoint setelah render dapat membuang draf yang sudah lengkap.** Pisahkan kegagalan render dan kegagalan penyimpanan status. Marker token pada salinan memungkinkan pemulihan copy lengkap yang checkpoint-nya hilang; copy parsial belum diserahkan dapat diganti saat retry.
5. **Pemeriksaan baris nomor hanya pada pengajuan pertama.** Periksa ulang sebelum reservasi/arsip ketika retry. Simpan identitas reservasi agar retry tidak kembali mengantre reservasi yang sudah sukses. Tetap gunakan penguncian dan token idempoten allocator yang ada.
6. **Pembacaan master berulang.** Gunakan satu handle master per eksekusi, baca master gedung hanya untuk jenis gedung ketika membentuk draf. Tidak memakai cache lintas permintaan sehingga perubahan master tetap terbaca.
7. **Inisialisasi ledger serentak.** Uji riil menemukan metadata sheet yang dibaca sebelum lock dapat tetap stale sesudah lock. Buka workbook privat pertama kali di dalam lock, karena handle yang dibuka sebelum lock juga dapat menyimpan daftar sheet lama. Tes cold start memakai nama ledger staging baru, tanpa menghapus catatan uji sebelumnya.
8. Hapus operasi regex nama file yang mengembalikan teks sama persis. Endpoint pratinjau lama dan `withNumber` dipertahankan untuk kompatibilitas halaman lama, bukan dianggap dead code.

## Pengujian otomatis

Sembilan suite: `reservations`, `admin-edit`, `letter-codes`, `final-letters`, `final-resumable`, `final-upload-client`, `production-release`, `letter-drafts`, `letter-draft-jobs`.

Kasus penting mencakup slot tanggal mundur habis, pergantian tahun, idempotensi token, gagal upload setelah reservasi, gagal checkpoint, baris nomor diedit/hilang, pemulihan draf tanpa copy tambahan, penyimpanan privat, row sorting, record besar, 10 status proses terpisah, format UUID, dan metadata sheet dibaca dalam lock. Uji regresi unggahan PDF final tetap mencakup ukuran maksimum 20 MiB dan interleaving sepuluh transfer. Pemeriksaan sintaks menemukan 190 fungsi server unik tanpa deklarasi ganda.

## Hasil uji riil

Baseline v43: 10/10 berhasil, peak concurrency 10, 62 detik termasuk verifikasi dan retry. Pembuatan draf 9,0–12,9 detik; pengajuan nomor 29,0–35,1 detik per permintaan. Nomor unik diperiksa menurut jenis surat dan tahun, karena counter Surat Dinas dan Nota Dinas memang terpisah.

Iterasi awal ledger baru menemukan kegagalan cold-start metadata sheet dan tidak dipromosikan ke produksi. Iterasi yang membuka workbook setelah lock berhasil 10/10 (peak 10, 121 detik termasuk retry/verifikasi). Selanjutnya akses ledger memakai ID sheet yang sudah ditetapkan agar tidak mengulang lock inisialisasi pada setiap permintaan. Versi terakhir diuji ulang di bawah.

### Versi akhir yang diuji

Commit aplikasi uji `d029639dbf26209da13a4e3e4c3ce4600017b40a`.

| Skenario | Hasil | Puncak eksekusi | Draf per permintaan | Pengajuan nomor per permintaan | Total uji |
|---|---:|---:|---:|---:|---:|
| 10 permintaan, inisialisasi ledger baru | 10/10 | 10 | 22,3–28,6 detik | 40,1–45,4 detik | 94 detik |
| 5 permintaan, penyimpanan sudah siap | 5/5 | 5 | 9,5–15,8 detik | 20,4–24,7 detik | 53 detik |

Total uji mencakup tiga fase (buat, nomor, retry) dan verifikasi serial isi dokumen/PDF/register, bukan waktu satu pengguna menunggu tombol. Semua pengajuan ulang menghasilkan identitas dokumen/nomor yang sama. Data rinci ada pada `audit-load-10.json` dan `audit-load-5.json`. Gedung menggunakan master gedung dummy pada staging, template resminya dibaca tanpa diubah.

Penyimpanan durable menambah I/O dibanding v43. Hasil ini **tidak** menunjukkan semua operasi lebih cepat daripada baseline 62 detik. Optimasi lock mengurangi total dari iterasi durable 121 menjadi 94 detik, tetapi pengukuran bukan benchmark terkontrol layanan Google. Prioritasnya mencegah batas penyimpanan dan mempertahankan pemulihan/idempotensi. Tidak ada klaim jaminan waktu tetap.

Uji 10 kiriman serentak dengan token yang sama: **1 pengajuan berhasil, 9 ditahan saat proses aktif, 1 baris register, 1 nomor dan 1 dokumen**. Retry mengembalikan hasil yang sama. Peak server 10, active akhir 0. Bukti `audit-same-token.json` dan `audit-same-token.png`.

## Batas interpretasi

Hasil uji adalah bukti untuk beban dan data yang diuji, bukan jaminan tanpa gangguan Google/jaringan atau semua ukuran dokumen. Kuota platform tetap berlaku. Pengujian ini tidak mengalokasikan nomor produksi, tidak melakukan migrasi arsip tahunan produksi, dan tidak mengubah sharing master/template. Pembuatan draf tetap dapat diedit oleh pemegang tautan sesuai keputusan pemilik; arsip PDF/status proses tetap privat. Gangguan setelah nomor dicadangkan dipulihkan menggunakan token yang sama.

Rujukan platform: https://developers.google.com/apps-script/guides/services/quotas dan https://developers.google.com/apps-script/reference/lock/lock.

## Catatan rilis dan pemulihan

Status draf lama dibaca dari Script Properties jika belum ada pada ledger baru. Draf baru tidak ditulis kembali ke properti. Karena itu rollback langsung ke v43 tidak dapat melanjutkan draf baru yang hanya ada di ledger. Jika ada gangguan, matikan generator melalui `LETTER_DRAFT_ENABLED=0` sambil memperbaiki versinya; formulir pengajuan nomor biasa tetap terpisah. Jangan menghapus atau mengganti nama sheet/kolom `GENERATOR_JOBS` dan jangan membagikan ledger privat.
