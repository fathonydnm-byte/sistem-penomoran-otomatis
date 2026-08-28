/**
 * Arsip tahunan untuk PERMINTAAN dan LOG_PERUBAHAN.
 *
 * Tujuan: menjaga tab data yang dipakai aktif (PERMINTAAN, LOG_PERUBAHAN) tetap
 * ringkas agar mudah di-scroll/cari, dengan memindah baris dari tahun-tahun
 * sebelumnya ke tab arsip terpisah per tahun (mis. ARSIP_PERMINTAAN_2026).
 * Data tahun berjalan tidak pernah disentuh.
 *
 * Setelah diarsipkan, data lama dianggap final/historis: menu "Edit Permintaan
 * Terpilih" dan "Batalkan Permintaan" hanya bekerja untuk data yang masih ada
 * di tab PERMINTAAN (tahun berjalan). Koreksi data lama dilakukan manual
 * langsung di tab arsipnya.
 */

/**
 * Dipanggil dari menu "Arsipkan Data Tahun Lalu" oleh admin.
 */
function archiveOldYearsManual() {
  var adminEmail = assertAdmin_();
  var ui = SpreadsheetApp.getUi();

  var response = ui.alert(
    'Arsipkan Data Tahun Lalu',
    'Semua baris PERMINTAAN dan LOG_PERUBAHAN dari tahun-tahun sebelum ' +
    'tahun berjalan akan dipindah ke tab arsip terpisah per tahun ' +
    '(mis. ARSIP_PERMINTAAN_2026). Data tahun berjalan tidak akan disentuh. ' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) {
    return;
  }

  try {
    var result = runArchive_('Arsip manual oleh admin', adminEmail);
    if (result.totalArchived === 0) {
      ui.alert('Tidak ada data tahun sebelumnya yang perlu diarsipkan saat ini.');
      return;
    }
    ui.alert(
      'Arsip selesai.\n\n' +
      result.requestArchived + ' baris PERMINTAAN dan ' +
      result.logArchived + ' baris LOG_PERUBAHAN dipindah ke tab: ' +
      result.archiveSheets.join(', ')
    );
  } catch (error) {
    ui.alert('Arsip gagal: ' + (error && error.message ? error.message : String(error)));
  }
}

/**
 * Dipanggil otomatis oleh trigger terjadwal (lihat ensureArchiveTrigger_).
 * Apps Script tidak punya trigger "tahunan" bawaan, jadi ini dipasang sebagai
 * trigger BULANAN yang aman dipanggil berkali-kali: runArchive_ hanya benar-
 * benar memindahkan data ketika ada baris dari tahun sebelum tahun berjalan,
 * jadi praktiknya cuma "berbunyi" tepat setelah pergantian tahun.
 */
function runScheduledArchive_() {
  try {
    var result = runArchive_(
      'Arsip otomatis tahunan (trigger terjadwal)',
      'SISTEM (trigger otomatis)'
    );
    if (result.totalArchived > 0) {
      notifyArchiveResult_(result);
    }
  } catch (error) {
    try {
      MailApp.sendEmail(
        APP.ADMIN_EMAIL,
        'Arsip Otomatis Sistem Nomor Surat Gagal',
        'Proses arsip otomatis tahunan gagal dengan pesan berikut. ' +
        'Silakan jalankan manual lewat menu "Arsipkan Data Tahun Lalu", ' +
        'atau hubungi pengembang bila terus gagal.\n\n' +
        (error && error.message ? error.message : String(error))
      );
    } catch (mailError) {
      // Jangan biarkan kegagalan kirim email menutupi error aslinya di log.
    }
  }
}

function notifyArchiveResult_(result) {
  try {
    MailApp.sendEmail(
      APP.ADMIN_EMAIL,
      'Arsip Tahunan Sistem Nomor Surat Selesai',
      'Arsip otomatis tahunan berhasil dijalankan.\n\n' +
      result.requestArchived + ' baris PERMINTAAN dan ' +
      result.logArchived + ' baris LOG_PERUBAHAN dipindah ke tab: ' +
      result.archiveSheets.join(', ') + '.\n\n' +
      'Data tahun berjalan tidak terpengaruh.'
    );
  } catch (mailError) {
    // Notifikasi opsional; kegagalan kirim email tidak boleh dianggap
    // sebagai kegagalan proses arsip itu sendiri.
  }
}

/**
 * Memastikan trigger bulanan untuk arsip otomatis terpasang. Idempotent -
 * dipanggil dari initializeApplication() sehingga aman dijalankan berkali-kali
 * lewat menu "Instal / Perbaiki Sistem" tanpa membuat trigger duplikat.
 */
function ensureArchiveTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runScheduledArchive_') {
      return;
    }
  }

  ScriptApp.newTrigger('runScheduledArchive_')
    .timeBased()
    .onMonthDay(2)
    .atHour(2)
    .create();
}

/**
 * Inti proses arsip: memindah baris PERMINTAAN dan LOG_PERUBAHAN dari tahun
 * sebelum tahun berjalan ke tab ARSIP_<nama sheet>_<tahun>, lalu menuliskan
 * satu baris log yang merangkum aksi ini.
 *
 * Berjalan di dalam satu lock singkat: setiap sheet hanya dibaca sekali
 * (getValues) dan ditulis ulang sekali/dua kali (bukan baris demi baris),
 * sehingga durasi lock tetap singkat walau datanya ribuan baris.
 */
function runArchive_(reason, actorEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error(
      'Sistem sedang sibuk, arsip tidak dapat dijalankan sekarang. Coba lagi beberapa saat lagi.'
    );
  }

  try {
    var spreadsheet = getSpreadsheet_();
    var currentYear = Number(Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy'));

    var requestResult = archiveSheetRowsOlderThanYear_(
      spreadsheet,
      APP.DATA_SHEET,
      REQUEST_HEADERS,
      currentYear,
      yearFromRequestRow_
    );

    var logResult = archiveSheetRowsOlderThanYear_(
      spreadsheet,
      APP.LOG_SHEET,
      LOG_HEADERS,
      currentYear,
      yearFromLogRow_
    );

    var totalArchived = requestResult.archivedRows + logResult.archivedRows;
    var archiveSheets = requestResult.archiveSheetNames.concat(logResult.archiveSheetNames);

    if (totalArchived > 0) {
      appendLogRows_([[
        new Date(),
        '-',
        '-',
        'ARSIP_TAHUNAN',
        '-',
        '-',
        requestResult.archivedRows + ' baris PERMINTAAN, ' +
          logResult.archivedRows + ' baris LOG_PERUBAHAN dipindah ke: ' +
          archiveSheets.join(', '),
        reason,
        actorEmail
      ]]);
    }

    return {
      totalArchived: totalArchived,
      archiveSheets: archiveSheets,
      requestArchived: requestResult.archivedRows,
      logArchived: logResult.archivedRows
    };
  } finally {
    lock.releaseLock();
  }
}

function yearFromRequestRow_(row) {
  return Number(row[12]);
}

function yearFromLogRow_(row) {
  var timestamp = row[0] instanceof Date ? row[0] : new Date(row[0]);
  if (isNaN(timestamp.getTime())) {
    return NaN;
  }
  return Number(Utilities.formatDate(timestamp, APP.TIMEZONE, 'yyyy'));
}

function archiveSheetRowsOlderThanYear_(spreadsheet, sheetName, headers, currentYear, yearOf) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return { archivedRows: 0, archiveSheetNames: [] };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { archivedRows: 0, archiveSheetNames: [] };
  }

  var numColumns = headers.length;
  var allValues = sheet.getRange(2, 1, lastRow - 1, numColumns).getValues();

  var keepRows = [];
  var byYear = {};

  for (var i = 0; i < allValues.length; i++) {
    var row = allValues[i];
    if (isRowBlank_(row)) {
      continue;
    }

    var year = yearOf(row);
    if (isFinite(year) && year < currentYear) {
      var key = String(year);
      if (!byYear[key]) {
        byYear[key] = [];
      }
      byYear[key].push(row);
    } else {
      keepRows.push(row);
    }
  }

  var years = Object.keys(byYear);
  if (!years.length) {
    return { archivedRows: 0, archiveSheetNames: [] };
  }

  var archiveSheetNames = [];
  var archivedRows = 0;

  for (var y = 0; y < years.length; y++) {
    var year = years[y];
    var archiveSheetName = 'ARSIP_' + sheetName + '_' + year;
    var archiveSheet = spreadsheet.getSheetByName(archiveSheetName);
    if (!archiveSheet) {
      archiveSheet = spreadsheet.insertSheet(archiveSheetName);
      archiveSheet.getRange(1, 1, 1, numColumns).setValues([headers]);
    }

    var rowsForYear = byYear[year];
    var archiveLastRow = archiveSheet.getLastRow();
    archiveSheet.getRange(archiveLastRow + 1, 1, rowsForYear.length, numColumns)
      .setValues(rowsForYear);

    archiveSheetNames.push(archiveSheetName);
    archivedRows += rowsForYear.length;
  }

  sheet.getRange(2, 1, lastRow - 1, numColumns).clearContent();
  if (keepRows.length) {
    sheet.getRange(2, 1, keepRows.length, numColumns).setValues(keepRows);
  }

  return { archivedRows: archivedRows, archiveSheetNames: archiveSheetNames };
}

function isRowBlank_(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) {
      return false;
    }
  }
  return true;
}
