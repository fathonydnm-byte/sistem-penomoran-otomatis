# PRD Generator Surat Dinas dan Nota Dinas SIDDIQ
Versi 1.0 • 6 November 2026 • Pemilik produk Achmad Fathony

Status: rancangan siap ditinjau. Belum implementasi, belum uji aplikasi, belum deploy.
Lingkup paket ini mencakup PRD, kontrak mail merge, struktur master, rencana sprint dan matriks penerimaan.

## 1. Tujuan dan batas pekerjaan
Pengguna menghasilkan draft seragam berdasarkan template resmi, dengan pilihan membuat draft saja atau sekaligus mengajukan nomor melalui mekanisme penomoran yang sudah ada. Hasil berupa Google Docs editable. Aplikasi selesai setelah dokumen lengkap diserahkan; perubahan selanjutnya dilakukan di Docs dan tidak disinkronkan kembali ke register.

Tahap pertama meliputi Surat Dinas, Nota Dinas Undangan, Permohonan ST dan SPD, Peminjaman Gedung, Peminjaman Kendaraan Dinas, Permohonan SK, dan Nota Dinas Perihal Khusus/Buat Sendiri.
Tidak termasuk penerbitan SK itu sendiri, pemasangan nomor lama, melanjutkan draft mandiri ke pengajuan, editor tabel dalam form, sinkronisasi edit Docs, atau pengubahan fitur upload final surat.

## 2. Keputusan produk yang telah disepakati
- Dua aksi: “Buat draft saja” dan “Buat draft & ajukan nomor”.
- Draft mandiri tidak mengonsumsi nomor dan boleh dipakai untuk tanggal yang tidak didukung penomoran aplikasi.
- Draft bernomor tunduk pada seluruh aturan penomoran saat ini, termasuk slot backdate, tahun dan pembatalan. Tidak membuat aturan tanggal baru.
- Jika slot tidak ada, jelaskan kegagalan, pertahankan isian selama halaman terbuka, tawarkan draft saja.
- Jenis SD/ND berasal dari pilihan template, bukan isian bebas. Perihal, Dari dan Tujuan otomatis diteruskan ke register. Pemohon melengkapi nama dan unit kerja.
- Dari pada register SD memakai nama penandatangan lengkap; Dari ND memakai nama penandatangan tanpa gelar. Template SD tidak ditambahi baris Dari.
- Nama SD lengkap beserta gelar dan NIP. Nama ND tanpa gelar, tanpa NIP penandatangan. NIP personel dalam badan ND ST/SPD tetap ada.
- Semua pejabat aktif dapat dipilih. Bentuk langsung atau a.n. Rektor mengikuti pasangan valid dalam master. Plt./Plh. mengikuti master.
- Hasil Docs dapat diedit siapa pun pemegang tautan. Tidak meminta email. Hanya file hasil diberi akses ini, bukan folder, template, master atau arsip PDF.
- Lampiran/tembusan diedit sendiri di Docs. Lamp. pada SD tetap “-” sesuai template.
- Editor isi mendukung paragraf, tebal/miring, daftar bernomor/berpoin. Tabel khusus diedit setelah hasil di Docs.
- Tanggal surat dan pengajuan aktual disimpan terpisah di register. Tanggal kegiatan dipakai untuk merge, tidak menjadi kolom tanggal tambahan register.
- Semua ND mengikuti urutan penerima default, dengan tambah manual dan tombol naik/turun.
- Satu gedung per surat. Tujuan mengikuti master gedung; gedung tanpa pemetaan tidak dapat diproses sampai master dilengkapi.
- Kendaraan selalu ditujukan ke Kepala Bagian Umum Kantor Pusat UIN Sunan Ampel Surabaya. Tidak ada pilihan jenis kendaraan. Jumlah kendaraan/peserta opsional.

## 3. Alur pengguna
1. Buka tawaran ringkas “Buat surat dengan template resmi” pada halaman depan; kelompokkan dengan bantuan template/kode yang sudah ada, hindari kartu besar bertumpuk.
2. Pilih SD atau ND. Pada ND pilih satu dari enam jenis.
3. Isi tanggal surat, sifat, penandatangan dan bentuk tanda tangan, lalu data khusus template.
4. Tampilkan pratinjau isi, penerima berurutan dan kode dengan nomor belum terbit.
5. Draft saja menghasilkan Docs dengan nomor kosong berpenanda jelas yang mudah diganti manual, tanpa register/counter.
6. Draft & ajukan nomor meminta nama pemohon dan unit, memperlihatkan ringkasan sebelum satu kali pengiriman.
7. Sistem menyiapkan draft PDF, meminta nomor, memasang nomor lengkap pada Docs, menyimpan hubungan ke permohonan, lalu memberi tautan hasil.
8. Jika proses terputus setelah nomor terbit, pemulihan menggunakan transaksi dan nomor yang sama.

Validasi server menjadi otoritas untuk master, kode, tanggal, slot dan identitas transaksi. Data HTML dari editor harus dibatasi ke format yang didukung dan disanitasi. Nama/NIP diperlakukan sebagai teks, termasuk saat menulis Sheets.

## 4. Kode lengkap
Sifat mengikuti master existing: B Biasa, Sg Segera, Pt Penting, R Rahasia, SR Sangat Rahasia.
Kode langsung: {sifat}-{nomor}/Un.07/01/{kode_pejabat}/{klasifikasi}/{MM}/{YYYY}
Kode a.n.: {sifat}-{nomor}/Un.07/01/R/{kode_pelaksana}/{klasifikasi}/{MM}/{YYYY}
Contoh bentuk existing: B-469/Un.07/01/R/BU/PP.00.9/04/2026.
Pejabat yang kode jabatannya memang kosong tetap boleh menandatangani (keputusan pemilik 6 November 2026). Pertahankan segmen kosong: langsung /Un.07/01//KLASIFIKASI/MM/YYYY dan a.n. /Un.07/01/R//KLASIFIKASI/MM/YYYY. Tidak ada kode atasan/pengganti atau teks null/undefined. Ini keputusan format implementasi untuk merepresentasikan kolom kosong secara literal; tampilkan pada contoh untuk review.
Kode pelaksana tidak boleh disimpulkan dari nama orang. Gunakan pemetaan jabatan resmi dari Excel dan LetterCodes.html. Rektor tidak menjadi pelaksana a.n. dirinya sendiri.
Bulan/tahun mengikuti tanggal surat dan tidak dapat diganti terpisah pada generator dokumen. Ini berbeda dengan generator rekomendasi kode existing yang tidak diubah oleh proyek ini.
Titik internal klasifikasi dipertahankan; tidak menambah titik penutup di akhir kode.

| Jenis | Klasifikasi |
|---|---|
| SD | Pilihan dari master valid |
| ND Undangan | HM.01 terkunci |
| ND ST/SPD | KP.01.1 terkunci |
| ND Gedung | KS.01.1 terkunci |
| ND Kendaraan | KS.01.5 terkunci |
| ND SK | HK.00.5 terkunci |
| ND Khusus | Pilihan dari master valid |

Primer–sekunder–tersier harus mengikuti hubungan master, tanpa kode bebas di luar master.

## 5. Form per template
| Template | Isian dan aturan |
|---|---|
| SD | Perihal, tujuan internal/master atau eksternal/manual, isi berformat dasar, tanggal, sifat, penandatangan, bentuk, klasifikasi |
| Undangan | Multi-penerima, tanggal kegiatan, waktu, tempat, acara wajib; dasar undangan, tema dan catatan opsional; pembuka otomatis ketika dasar kosong; redaksi dapat diedit |
| ST/SPD | Dalam rangka/nama kegiatan, tempat penugasan, tanggal mulai/selesai, personel dari master atau manual; default semua personel satu jadwal/tempat; satu personel blok existing, beberapa personel tabel badan surat |
| Gedung | Dalam rangka, satu gedung, tanggal/jadwal, waktu, jumlah peserta, nama/kontak PJ; tujuan dari gedung; tempat default nama gedung |
| Kendaraan | Dalam rangka, tanggal/jadwal, waktu, tempat kegiatan, nama/kontak PJ; jumlah kendaraan dan peserta opsional; tanpa jenis kendaraan |
| SK | Dalam rangka wajib, tujuan Rektor, perihal dan redaksi tetap; lampiran ditambahkan pengguna sendiri |
| ND Khusus | Perihal, multi-penerima, isi berformat dasar, klasifikasi dari master |

Hari dihitung dari tanggal, rentang akhir tidak mendahului awal. Waktu default WIB mengikuti template; tanggal surat tidak disamakan dengan tanggal kegiatan.
Personel manual tidak wajib NIP bila memang tidak memiliki. Nama, jabatan dan data yang relevan tetap diperiksa sebelum pratinjau.
Asumsi rancangan untuk review: jadwal peminjaman dapat berupa rentang; detail banyak sesi terpisah disunting di Docs. Field dasar dapat memakai teks beberapa paragraf tanpa tabel.

## 6. Master dan relasi
Master dipelihara admin melalui spreadsheet pada tahap pertama. Gunakan ID stabil, bukan nama sebagai kunci.
| Tabel | Kolom inti |
|---|---|
| Pejabat | pejabat_id, jabatan_id, nama_lengkap, nama_tanpa_gelar, nip_text, status_jabatan, aktif |
| Jabatan | jabatan_id, label_resmi, kode_pejabat, prioritas_hierarki, urutan_dalam_kelompok, kelompok_id, aktif |
| BentukTTD | jabatan_id, bentuk, kode_prefix_an, diizinkan, label_blok_ttd |
| Personel | personel_id, nama_lengkap, nip_nipppk_text, pangkat, golongan, jabatan, aktif |
| KelompokPenerima | kelompok_id, label_kelompok, daftar_jabatan_id, label_cetak_kelompok, aktif |
| Gedung | gedung_id, nama, lokasi, pejabat_tujuan_jabatan_id, aktif |
| Klasifikasi | kode, uraian, parent_id, level, aktif; adaptasi master Excel existing |
| Template | template_key, source_doc_id, versi, klasifikasi_tetap, aktif |
| Konfigurasi | target_folder_id, archive_folder_id, environment, feature_enabled |

Nama tanpa gelar wajib tersedia pada pejabat ND; jangan menghapus gelar dengan tebakan otomatis. Ejaan R2 tanpa gelar yang dikonfirmasi adalah Ali Mustofa. Satu orang dengan dua jabatan tetap dua pilihan. Jabatan sama dengan dua pejabat aktif harus ditolak saat validasi master sampai diperbaiki admin.
Data uji memakai salinan master ST/SPD sementara, dengan data dummy seperlunya. Master sumber tidak diubah.
Simpan snapshot data yang digunakan pada transaksi agar pergantian pejabat/master tidak mengubah dokumen yang sedang dipulihkan.
Kelompok Wakil Rektor mencakup Akademik dan Kelembagaan; Administrasi Umum, Perencanaan dan Keuangan; Kemahasiswaan dan Kerjasama. Tersedia pilihan kelompok dan individual; deduplikasi berdasarkan ID.
Usulan render kelompok: pilihan “seluruh” dicetak sebagai label kelompok, pilihan individual dicetak per jabatan; anggota yang tercakup kelompok tidak dicetak lagi.

## 7. Hierarki penerima
| Prioritas | Kelompok |
|---|---|
| 1 | Ketua dan Sekretaris Senat |
| 2 | Rektor |
| 3 | Wakil Rektor |
| 4 | Kepala Biro AAKK dan Kepala Biro AUPK |
| 5 | Direktur Pascasarjana |
| 6 | Dekan Fakultas |
| 7 | Wakil Direktur Pascasarjana |
| 8 | Wakil Dekan Fakultas |
| 9 | Ketua LPM dan Ketua LP2M |
| 10 | Kepala SPI |
| 11 | Wakil Koordinator Kopertais |
| 12 | Kepala UPT |
| 13 | Ketua Program Studi dan Sekretaris Program Studi |
| 14 | Kepala Bagian Umum, Kepala Bagian Akademik, Ketua Tim pada Biro AAKK/AUPK |
| 15 | Kepala Bagian Umum dan Kepala Subbagian Umum pada Fakultas/Pascasarjana |
| 16 | Dosen |
| 17 | Tenaga Kependidikan |

Urutan awal memakai prioritas dan urutan_dalam_kelompok. Jika urutan internal belum tersedia, gunakan urutan pilihan yang stabil dan beri kemampuan pengaturan manual; jangan mengarang senioritas.
Penerima manual mulai di bagian akhir. Naik/turun menyusun ulang nomor urut. Penambahan penerima sesudah reorder tidak merusak urutan manual; tombol “Kembalikan urutan hierarki” mengembalikan default.
Status Plt./Plh. mengubah label, tidak mengubah peringkat.

## 8. Pemetaan mail merge
Placeholder di bawah merupakan kontrak target pada salinan kerja. Template resmi asli tidak diubah otomatis.
| Placeholder target | Sumber/aturan |
|---|---|
| KODE_SURAT_LENGKAP | Disusun server dari snapshot master + nomor resmi; draft mandiri menggunakan penanda nomor |
| TANGGAL_SURAT | Tanggal surat format Indonesia |
| PERIHAL_SURAT | SD/kustom dari user; ND khusus default template; gedung menyertakan nama gedung |
| TUJUAN_SURAT_DINAS | Pilihan internal atau teks eksternal |
| DAFTAR_PENERIMA | Daftar berurutan tanpa duplikasi atau tujuan tetap dari aturan jenis |
| NAMA_DARI | Nama penandatangan, tanpa gelar untuk ND |
| URGENSI_SURAT | Label sifat |
| ISI_SURAT_DINAS / ISI_NOTA_DINAS | Isi berformat dasar yang telah disanitasi |
| BLOK_JABATAN_TTD | Bentuk langsung atau a.n. Rektor + jabatan/status pelaksana |
| NAMA_TTD | Nama lengkap SD / tanpa gelar ND |
| NIP_TTD | Hanya SD; jangan tambahkan baris NIP kosong pada ND |
| RANGKA_KEGIATAN | Dalam rangka/nama kegiatan |
| DASAR_UNDANGAN | Opsional; kosong mengganti kalimat pembuka |
| HARI_TANGGAL_KEGIATAN | Hari otomatis + tanggal/rentang |
| WAKTU_KEGIATAN | Waktu yang telah diformat |
| TEMPAT_KEGIATAN | Tempat kegiatan/penugasan; bukan selalu gedung |
| ACARA | Acara undangan |
| TEMA_KEGIATAN / CATATAN_KEGIATAN | Opsional; hilangkan seluruh baris bila kosong |
| BLOK_PERSONEL | Satu blok atau tabel dinamis; NIP sebagai string |
| NAMA_GEDUNG | Label master gedung |
| JUMLAH_PESERTA / JUMLAH_KENDARAAN | Nilai positif; opsional pada kendaraan, hilangkan baris kosong |
| PJ_CONTACT | Gabungan nama dan kontak dari dua input |

Normalisasi sumber lama:
- MASTER_NAMA_PEJABAT di “Dari” menjadi NAMA_DARI; pada tanda tangan menjadi NAMA_TTD.
- MASTER_PEJABAT menjadi BLOK_JABATAN_TTD; MASTER_NIP_PEJABAT menjadi NIP_TTD khusus SD.
- Rangkaian placeholder nomor diganti KODE_SURAT_LENGKAP untuk mencegah sisa komponen a.n.
- HIRARKI_PEJABAT GEDUNG menjadi DAFTAR_PENERIMA dari master.
- HARI_TANGGAL KEGIATAN dan variasi penugasan/peminjaman dinormalisasi ke HARI_TANGGAL_KEGIATAN.
- NAMA_GEDUNG pada kendaraan diganti TEMPAT_KEGIATAN.
- Placeholder personel tunggal diganti BLOK_PERSONEL.
- ND Undangan sumber HK.00.5 menjadi HM.01; ST/SPD sumber HM.01 menjadi KP.01.1.
- Usulan editorial SK “berkenaan menerbitkan” menjadi “berkenan menerbitkan”, ditandai untuk review pemilik.
- Daftar penerima yang berupa drawing pada undangan diganti elemen teks/list dinamis pada salinan uji.
- Hindari replacement global nama yang tidak membedakan peran. Periksa body, tabel, header/footer dan placeholder yang terpecah text run.
- Hasil harus bebas placeholder tersisa, termasuk saat isian opsional kosong.

## 9. Transaksi dan integrasi
Rancangan status: VALIDATED → DRAFT_READY → NUMBER_ASSIGNED → DOC_FILLED → READY.
Cabang draft mandiri: VALIDATED → DRAFT_READY → READY tanpa NUMBER_ASSIGNED.
Status kegagalan menyimpan failed_stage, kode kesalahan aman dan referensi artefak yang sudah jadi.

request_id unik dibuat sekali per aksi logis; retry memakai ID sama. Server menyimpan hash payload. Payload berbeda dengan ID sama ditolak, bukan mengganti surat di transaksi lama.
Gunakan jalur reserveRequest/claimBackdatedSlot_ existing dan audit kontrak sebelum implementasi. Jangan membuat counter kedua. Simpan record_id, nomor dan tanggal dari hasil server.
Lock singkat hanya melindungi alokasi/transisi kritis; jangan menahan global lock selama render, PDF atau operasi Drive. Klaim proses per request mencegah dua worker membuat hasil ganda.
Simpan doc_id sebelum proses berikutnya agar retry memperbaiki dokumen sama. PDF draft dibekukan saat pengajuan dan dipautkan ke record. Google Docs dapat berubah setelah diserahkan tanpa mengubah PDF/catatan register.
Jika nomor terbit tetapi Docs/share gagal, tampilkan nomor telah terbit dan aksi melanjutkan proses. Jangan otomatis mengembalikan nomor ke slot karena dokumen gagal.
Keberhasilan baru dinyatakan setelah nomor benar, dokumen selesai dan akses hasil berhasil. Draft bernomor tetap bukan final bertanda tangan dan tidak mengubah kewajiban upload final.
Usulan transaksi menyimpan request_id, payload_hash, snapshot_json, stage, record_id, nomor, doc_id, pdf_id, template_version, error_code, created_at, updated_at. Timestamp teknis berbeda dari kolom bisnis tanggal kegiatan.
Dokumen hasil tidak ditampilkan dalam riwayat publik pemohon; kirim tautan lewat respons transaksi. Mengetahui nama pemohon saja tidak boleh mengambil status transaksi orang lain.
Status/progress menampilkan tahap riil, tanpa persentase palsu; pemulihan tidak memerlukan klik ajukan baru.

## 10. Sumber dan bukti
Folder resmi: https://drive.google.com/drive/folders/1f_Uq5h3SJoT5X5GyfLyon_-qef-933_n
| Template | Google Docs ID |
|---|---|
| SD terbaru | 1Dq1akA91_aVFy_zdqdaOULq9aKDQsgb8Ag1Uzgrz1FI |
| ND dasar | 184rL16bHuMSlzBOfVZUZvQ6LObOaimJEpnqSLpZyulI |
| Undangan | 1e4YxJcxaXTRK8yur6IDYnvuqVlYZ7i4fihR2zT0LNWo |
| ST/SPD | 1_5kGuI_V5Yzq73fyyOlnT6Qe-mhgu-xITk-w280FG2M |
| Gedung | 1QJKG0EbY_tGtfsGUNGG2L0mGenxZUF2CTaBGnuQI4bI |
| Kendaraan | 1h4KXa3KcJRNo6VLfQ3N95_j7PisL88L2iaUu1cKOS9U |
| SK | 16_Ga72iNUeA2Md1v7xQohxwmNISnJYTrl3xf22-FX1Y |

Isi template dibaca pada sesi perencanaan 6 November 2026. Pembacaan teks bukan bukti layout hasil merge sudah benar.
Hierarki berasal dari gambar pengguna, ditambah keputusan posisi Rektor dan Direktur Pascasarjana.
Kode resmi mengikuti Excel yang telah dikonfirmasi pemilik; lihat docs/generator-kode-surat.md. Integrasi yang direncanakan mengacu Code.js reserveRequest/uploadDraft dan Reservations.js claimBackdatedSlot_.
Dokumentasi docs/template-resmi.md memuat histori perbaikan kop; label “final surat ditunda” di dokumen lama adalah histori, bukan status proyek saat ini.

## 11. Matriks uji penerimaan
Semua skenario berikut BELUM DIJALANKAN untuk fitur baru.
| ID | Skenario | Hasil yang diwajibkan |
|---|---|---|
| A01 | Draft saja semua 7 template | Docs editable, tidak ada nomor/counter/register baru |
| A02 | SD langsung | Nama lengkap, NIP, kode pejabat dan tanggal tepat |
| A03 | SD dan ND a.n. | Segmen R/pelaksana tepat, blok ttd sesuai master |
| A04 | ND semua jenis | Nama tanpa gelar, tanpa NIP penandatangan |
| A05 | Lima ND khusus | Klasifikasi tepat dan tidak dapat diganti lewat manipulasi payload |
| A06 | Klasifikasi bercabang | Anak sesuai parent; pilihan di luar master ditolak server |
| A07 | Undangan Rektor/Direktur | Posisi sesuai hierarki 17 kelompok |
| A08 | Kelompok + individu | Tidak ada penerima ganda |
| A09 | Manual/reorder/reset | Urutan terjaga dan nomor daftar berurutan |
| A10 | Opsional undangan kosong | Tidak ada label/baris kosong atau kalimat pembuka menggantung |
| A11 | ST/SPD 1, 2, 20, 55 orang | Badan/tabel berlanjut rapi, header tabel ulang, ttd tidak terpotong |
| A12 | Personel manual tanpa NIP | Tidak mengarang NIP; identitas lainnya tetap benar |
| A13 | Jadwal lintas bulan/tahun | Hari/rentang benar, kode tetap mengikuti tanggal surat |
| A14 | Gedung tiap pejabat tujuan | Mapping Rektor/WR II/Kabag tepat; mapping kosong ditolak |
| A15 | Kendaraan opsional kosong/terisi | Tanpa jenis kendaraan; jumlah hanya tampil jika diisi |
| A16 | Backdate tersedia | Nomor slot dan tanggal sesuai server |
| A17 | Backdate habis | Tidak menerbitkan nomor; data tetap ada; draft saja tersedia |
| A18 | Klik ganda/retry/refresh | Maksimal satu nomor dan satu hasil logis per request |
| A19 | 5–10 pengajuan bersamaan | Nomor unik, payload dan dokumen tidak tertukar |
| A20 | Drive gagal setelah nomor terbit | Retry memakai nomor sama, tidak mengembalikan slot otomatis |
| A21 | Gagal berbagi Docs | Status tidak sukses palsu; dapat dilanjutkan |
| A22 | Nama panjang/isi 1–5 halaman | Kop, paragraf, tabel, footer dan ttd rapi |
| A23 | Edit Docs setelah selesai | Register/PDF draft tidak berubah, kewajiban final tetap ada |
| A24 | Izin hasil | Link editor bekerja; izin master/folder/PDF tidak melebar |
| A25 | Master berubah saat retry | Snapshot lama dipakai untuk transaksi yang sama |
| A26 | Payload berbahaya/ID milik request lain | Ditolak; tidak menimpa data/formula atau file lain |
| A27 | Regresi fitur lama | Nomor biasa/massal, backdate, edit admin, upload draft/final tetap lulus |
| A28 | Mobile/desktop | Form mudah dipakai, reorder/preview/progress dapat diakses |
| A29 | Semua output | Tidak ada placeholder mentah tersisa |
| A30 | Berbagai ukuran hasil | Waktu tiap tahap dicatat; tidak mengklaim SLA sebelum pengukuran |

Bukti uji harus memuat build SHA, environment, data dummy, hasil aktual, screenshot/render, durasi dan issue. Uji beban memakai project/Sheets/Drive uji, bukan counter produksi.

## 12. Sprint dan gerbang rilis
| Tahap | Hasil | Syarat selesai |
|---|---|---|
| 0 Perencanaan | Dokumen ini dan keputusan teridentifikasi | Review pemilik atas PRD |
| 1 Master dan template uji | Salinan master/template, normalisasi placeholder, contoh tiap jenis | Review isi dan render, mapping gedung terisi untuk kasus uji |
| 2 Generator draft | Form, preview, Docs, sharing | A01–A15/A22/A24/A28/A29 lulus sesuai lingkup |
| 3 Integrasi nomor | PDF arsip, request idempotent, pemulihan | A16–A21/A23/A25/A26 lulus |
| 4 UAT terisolasi | Bukti uji fungsional, concurrency dan regresi | Seluruh kasus relevan lulus; pemilik mencoba sendiri |
| 5 Persiapan live | Backup, daftar konfigurasi, rollback, flag fitur | Persetujuan pemilik setelah UAT; baru deployment |

Tidak membuat trigger, mengubah master sumber, menulis counter atau deploy live selama tahap dokumen.
Environment uji wajib memakai Apps Script, Sheets, folder hasil dan arsip terpisah. ID produksi ditolak oleh konfigurasi uji. Default feature_enabled false sampai siap.
Rollback mematikan entry fitur baru dan mengembalikan versi aplikasi sebelumnya; nomor yang sudah terbit tetap dipertahankan. Jangan menghapus transaksi untuk mengulang nomor.

## 13. Data yang masih menunggu dan asumsi review
- Master pejabat terbaru dengan nama lengkap/tanpa gelar, NIP, jabatan aktif dan Plt./Plh.; sementara gunakan salinan ST/SPD.
- Daftar gedung dan mapping persetujuan resmi dari pemilik.
- Urutan internal jabatan setingkat yang belum eksplisit; fallback stabil dijelaskan di bagian 7.
- Konfirmasi editorial “berkenan”, format cetak kelompok, serta periode peminjaman merupakan detail review contoh, bukan alasan mengubah sistem live.
- Penetapan batas jumlah personel/penerima dan target durasi dilakukan setelah uji template dan platform; tidak menjanjikan kapasitas tanpa bukti.
- Kemampuan akun/deployment memberi anyone-with-link editor harus diuji; jika kebijakan akun melarang, tampilkan kendala tanpa sukses palsu.
