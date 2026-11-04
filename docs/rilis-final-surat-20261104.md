# Rilis surat final — 4 November 2026

Pemilik mengizinkan deployment produksi untuk pengujian riil sambil berjalan.
Rilis berisi pelengkapan final, monitoring admin, ekspor PDF/XLSX, optimasi
unggah, dan bantuan kode surat kecil di samping template resmi.

Konfigurasi project, spreadsheet, root draft, akses anonim dan deployment URL
produksi dipertahankan. Tidak menyertakan Staging.js, fixture, dummy PDF, kode
admin dummy atau workflow staging. Kode admin massal produksi tetap berlaku.

Spreadsheet utama memiliki izin Anyone reader. Karena itu, ledger SURAT_FINAL
dan LOG_SURAT_FINAL dibuat di workbook privat tersendiri; PDF tersimpan dalam
folder privat tersendiri di My Drive akun deployer. ID konfigurasi ada pada
Script Properties FINAL_PROD_LEDGER_ID dan FINAL_PROD_ROOT_ID, bukan sheet publik.
Setiap eksekusi pemeriksaan ledger menolak akses umum; PDF memeriksa akses
folder dan subfolder. Riwayat publik tetap memakai allowlist.

Pada pembukaan pertama, penyiapan idempotent membuat salinan cadangan workbook
utama sebelum membuat penyimpanan privat. ID salinan tersimpan pada
FINAL_PROD_BACKUP_ID. Operasi Drive berjalan di luar lock permintaan; lock hanya
untuk klaim/finalisasi singkat. Kegagalan dapat dicoba ulang tanpa menggandakan
cadangan/workbook. Selama penyiapan belum siap, formulir nomor tetap tersedia.
Tidak mengubah baris permintaan, draft, counter, kode akses atau trigger.

Riwayat permintaan yang memenuhi kewajiban final tetap berada pada PERMINTAAN
saat pergantian tahun agar monitoring dan pelengkapan tetap dapat dijangkau.
Baris dibatalkan tetap dapat diarsipkan mengikuti mekanisme yang ada.

Backup kode sebelum rilis: commit 2e66aafd737a2cd695de4535c08310031a2e8003.
Rollback: deploy kembali versi Apps Script sebelum rilis ke deployment yang
sama, atau pulihkan source commit tersebut lalu lakukan deployment ulang.
Jangan memulihkan spreadsheet cadangan di atas data aktif: permintaan setelah
snapshot harus dipertahankan. Ledger/PDF privat tetap disimpan ketika rollback.

Validasi: regresi reservasi dan editor, 21 skenario generator, 26 skenario final,
serta produksi (target, privasi, backup/retry, idempotensi dan arsip tahunan).
Uji UI di staging mengonfirmasi kode TL.03 langsung dan a.n. Rektor serta tahun
otomatis. Pengukuran transfer file nyata belum selesai ketika pemilik meminta
deployment; tidak ada klaim durasi unggah tertentu.
