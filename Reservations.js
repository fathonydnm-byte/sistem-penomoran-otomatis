/* All allocation helpers ending in _ require the same script lock as reserveRequest.
 * PERMINTAAN is authoritative; RESERVASI_NOMOR is the durable slot/audit index.
 */
var RESERVATION = {
  CONFIG: 'KONFIGURASI_RESERVASI', HOLIDAYS: 'HARI_LIBUR',
  SLOTS: 'RESERVASI_NOMOR', EVENTS: 'LOG_PERMINTAAN', REVIEW: 'TINJAU_SLOT_LAMA'
};
var SLOT_HEADERS = ['ID Slot', 'Tanggal Surat', 'Jenis Surat', 'Nomor', 'Asal',
  'Dibuat Pada', 'ID Permintaan Pemakai', 'Diambil Pada', 'File Placeholder Lama'];
var EVENT_HEADERS = ['Timestamp Kejadian', 'Waktu Pengajuan', 'Tanggal Surat', 'Jenis Surat',
  'Nomor', 'Perihal', 'Dari', 'Kepada', 'Nama Pemohon', 'Unit Kerja', 'Email',
  'ID Permintaan', 'Mode', 'Kejadian'];

function reservationDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP.TIMEZONE, 'yyyy-MM-dd');
  }
  var key = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Tanggal harus berformat YYYY-MM-DD.');
  var date = new Date(key + 'T00:00:00+07:00');
  if (isNaN(date.getTime()) || Utilities.formatDate(date, APP.TIMEZONE, 'yyyy-MM-dd') !== key) {
    throw new Error('Tanggal tidak valid.');
  }
  return key;
}

function reservationRows_(sheet, width) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
}

function reservationSheet_(name, headers) {
  var book = getSpreadsheet_();
  var sheet = book.getSheetByName(name) || book.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e7f0ea');
  return sheet;
}

function setupDailyReservations() {
  assertAdmin_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var data = getRequiredSheet_(APP.DATA_SHEET);
    var extraHeaders = data.getRange(1, 19, 1, 2).getValues()[0];
    if (extraHeaders.some(function(v, i) { return v && v !== REQUEST_HEADERS[18+i]; })) {
      throw new Error('Kolom S/T sudah dipakai. Hentikan pemasangan dan periksa struktur data.');
    }
    var config = reservationSheet_(RESERVATION.CONFIG, ['Kunci', 'Nilai', 'Keterangan']);
    if (config.getLastRow() === 1) config.getRange(2, 1, 6, 3).setValues([
      ['AKTIF', false, 'Gunakan menu Aktifkan setelah kalender diperiksa.'],
      ['MULAI_TANGGAL', '', 'Diisi otomatis saat aktivasi; tidak membuat slot retroaktif.'],
      ['Surat Dinas', 4, 'Jumlah slot per hari kerja; bilangan bulat 0–100.'],
      ['Nota Dinas', 4, 'Jumlah slot per hari kerja; bilangan bulat 0–100.'],
      ['SK/SE', 4, 'Satu counter gabungan SK dan SE.'],
      ['TAHUN_KALENDER_DIVERIFIKASI', '', 'Tahun kalender lengkap, pisahkan koma. Misalnya 2026,2027.']
    ]);
    reservationSheet_(RESERVATION.HOLIDAYS, ['Tanggal', 'Keterangan Libur Nasional']);
    reservationSheet_(RESERVATION.SLOTS, SLOT_HEADERS);
    reservationSheet_(RESERVATION.EVENTS, EVENT_HEADERS);
    ensureHeaders_(getSpreadsheet_());
    ensureStatusValidation_(getSpreadsheet_());
    return {success: true, message: 'Siap. Isi kalender nasional, verifikasi tahun, lalu aktifkan dari menu.'};
  } finally { lock.releaseLock(); }
}

function reservationConfig_() {
  var sheet = getSpreadsheet_().getSheetByName(RESERVATION.CONFIG);
  if (!sheet) return {active: false};
  var values = {};
  reservationRows_(sheet, 3).forEach(function(r) { values[r[0]] = r[1]; });
  var counts = {};
  Object.keys(DOCUMENT_TYPES).forEach(function(type) {
    var n = Number(values[type]);
    if (values[type] === '' || !isFinite(n) || n < 0 || n > 100 || Math.floor(n) !== n) {
      throw new Error('Jumlah reservasi ' + type + ' harus bilangan bulat 0–100.');
    }
    counts[type] = n;
  });
  return {active: String(values.AKTIF).toLowerCase() === 'true',
    start: values.MULAI_TANGGAL ? reservationDateKey_(values.MULAI_TANGGAL) : '',
    years: String(values.TAHUN_KALENDER_DIVERIFIKASI || '').split(',').map(function(y) { return y.trim(); }),
    counts: counts};
}

function activateDailyReservations() {
  assertAdmin_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var config = reservationConfig_();
    var today = reservationDateKey_(new Date());
    if (!config.years || config.years.indexOf(today.slice(0, 4)) === -1) {
      throw new Error('Lengkapi HARI_LIBUR dan TAHUN_KALENDER_DIVERIFIKASI sebelum aktivasi.');
    }
    var sheet = getRequiredSheet_(RESERVATION.CONFIG);
    reservationRows_(sheet, 3).forEach(function(r, i) {
      if (r[0] === 'MULAI_TANGGAL' && !r[1]) sheet.getRange(i + 2, 2).setValue(today);
      if (r[0] === 'AKTIF') sheet.getRange(i + 2, 2).setValue(true);
    });
    var exists = ScriptApp.getProjectTriggers().some(function(t) {
      return t.getHandlerFunction() === 'runDailyReservations';
    });
    // Minute trigger notices WIB midnight promptly; allocation is idempotent.
    if (!exists) ScriptApp.newTrigger('runDailyReservations').timeBased().everyMinutes(1).create();
    ensureDailyReservations_(new Date());
    return {success: true};
  } finally { lock.releaseLock(); }
}

function runDailyReservations() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { ensureDailyReservations_(new Date()); } finally { lock.releaseLock(); }
}

function reservationIsWorkingDay_(key) {
  var weekday = new Date(key + 'T12:00:00+07:00').getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !reservationRows_(getRequiredSheet_(RESERVATION.HOLIDAYS), 2).some(function(r) {
    return r[0] && reservationDateKey_(r[0]) === key;
  });
}

function ensureDailyReservations_(now) {
  var config = reservationConfig_();
  if (!config.active) return;
  var key = reservationDateKey_(now);
  var props = PropertiesService.getScriptProperties();
  // Finish an interrupted allocation before letting any other counter writer pass.
  var pending = props.getProperty('DAILY_RESERVATION_PENDING');
  if (pending) materializeReservationPlan_(JSON.parse(pending));
  if (props.getProperty('DAILY_RESERVATION_DONE') === key) return;
  if (!config.start || key < config.start) return;
  if (config.years.indexOf(key.slice(0, 4)) === -1) {
    throw new Error('Kalender libur nasional tahun ' + key.slice(0, 4) + ' belum diverifikasi admin.');
  }
  if (reservationIsWorkingDay_(key)) {
    Object.keys(DOCUMENT_TYPES).forEach(function(type) {
      var marker = 'DAILY_DONE_' + DOCUMENT_TYPES[type].fileCode;
      if (props.getProperty(marker) === key) return;
      var settings = resetCountersForNewYearIfNeeded_(getSettings_(), Number(key.slice(0, 4)));
      var start = Number(settings.values[DOCUMENT_TYPES[type].counterKey]);
      if (!isPositiveInteger_(start)) throw new Error('Counter reservasi tidak valid.');
      var plan = {date: key, type: type, start: start, count: config.counts[type], marker: marker};
      props.setProperty('DAILY_RESERVATION_PENDING', JSON.stringify(plan));
      materializeReservationPlan_(plan);
    });
  }
  props.setProperty('DAILY_RESERVATION_DONE', key);
}

function materializeReservationPlan_(plan) {
  var props = PropertiesService.getScriptProperties();
  var settings = getSettings_();
  if (Number(settings.values.COUNTER_YEAR) !== Number(plan.date.slice(0, 4))) {
    throw new Error('Alokasi reservasi belum selesai sebelum pergantian tahun. Hubungi admin.');
  }
  var counterKey = DOCUMENT_TYPES[plan.type].counterKey;
  var next = Number(settings.values[counterKey]);
  if (!isPositiveInteger_(next)) throw new Error('Counter tidak valid.');
  if (next < plan.start + plan.count) {
    var update = {}; update[counterKey] = plan.start + plan.count; setSettingValues_(update);
    SpreadsheetApp.flush();
  }
  var data = getRequiredSheet_(APP.DATA_SHEET);
  var existing = reservationRows_(data, REQUEST_HEADERS.length);
  var ledger = getRequiredSheet_(RESERVATION.SLOTS);
  var indexed = reservationRows_(ledger, SLOT_HEADERS.length);
  for (var i = 0; i < plan.count; i++) {
    var number = plan.start + i;
    var id = 'SLOT-' + plan.date + '-' + DOCUMENT_TYPES[plan.type].fileCode + '-' + number;
    var row = existing.filter(function(r) { return r[11] === id; })[0];
    if (!row) {
      if (existing.some(function(r) { return Number(r[1]) === number && r[2] === plan.type && Number(r[12]) === Number(plan.date.slice(0, 4)); })) {
        throw new Error('Benturan counter dengan nomor yang sudah ada. Alokasi dihentikan.');
      }
      row = [new Date(), number, plan.type, 'Slot Kosong', '', '', '', '', '', '',
        REQUEST_STATUS.RESERVED, id, Number(plan.date.slice(0, 4)), '', '', '', '',
        new Date(), plan.date, 'RESERVASI'];
      data.appendRow(row);
    }
    if (!indexed.some(function(r) { return r[0] === id; })) {
      ledger.appendRow([id, plan.date, plan.type, number, 'OTOMATIS', new Date(), '', '', '']);
    }
  }
  SpreadsheetApp.flush();
  props.setProperty(plan.marker, plan.date);
  props.deleteProperty('DAILY_RESERVATION_PENDING');
}

function validateBackdate_(raw) {
  var key = reservationDateKey_(raw);
  if (key >= reservationDateKey_(new Date())) throw new Error('Pilih tanggal sebelum hari ini (WIB).');
  return key;
}

function availableSlots_(type, key) {
  if (!DOCUMENT_TYPES[type]) throw new Error('Jenis surat tidak valid.');
  return reservationRows_(getRequiredSheet_(APP.DATA_SHEET), REQUEST_HEADERS.length)
    .map(function(values, i) { return {values: values, row: i + 2}; })
    .filter(function(record) {
      var r = record.values;
      return r[10] === REQUEST_STATUS.RESERVED && r[2] === type &&
        reservationDateKey_(r[18] || r[0]) === key;
    }).sort(function(a, b) { return Number(a.values[1]) - Number(b.values[1]); });
}

function checkBackdatedAvailability(payload) {
  var key = validateBackdate_(payload && payload.letterDate);
  return {date: key, count: availableSlots_(payload.documentType, key).length};
}

function claimBackdatedSlot_(request, rawDate, now) {
  var pending = PropertiesService.getScriptProperties().getProperty('DAILY_RESERVATION_PENDING');
  if (pending) materializeReservationPlan_(JSON.parse(pending));
  var key = validateBackdate_(rawDate);
  var slots = availableSlots_(request.documentType, key);
  if (!slots.length) throw new Error('Nomor cadangan tidak tersedia. Pilih tanggal lain atau hubungi admin Bagian Umum.');
  var slot = slots[0];
  var old = slot.values;
  var id = Utilities.getUuid();
  var row = [now, old[1], request.documentType, request.subject, request.from, request.to,
    request.applicantName, request.unit, getDetectedEmail_(), '', REQUEST_STATUS.WAITING_UPLOAD,
    id, Number(key.slice(0, 4)), request.draftName, '', request.token, getTemporaryUserKey_(), now, key, 'MUNDUR'];
  // Single authoritative write consumes slot AND binds token, so retries never allocate twice.
  getRequiredSheet_(APP.DATA_SHEET).getRange(slot.row, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
  try {
    var ledger = getRequiredSheet_(RESERVATION.SLOTS);
    reservationRows_(ledger, SLOT_HEADERS.length).some(function(r, i) {
      if (r[0] !== old[11]) return false;
      ledger.getRange(i + 2, 7, 1, 2).setValues([[id, now]]); return true;
    });
  } catch (e) { console.error('Slot index needs reconciliation: ' + id); }
  safeRequestEvent_(row, 'NOMOR_MUNDUR_DITERBITKAN');
  return {success: true, number: row[1], requestId: id, letterDate: key,
    status: row[10], uploadComplete: false};
}

function safeRequestEvent_(row, event) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(RESERVATION.EVENTS);
    if (!sheet) return;
    sheet.appendRow([new Date(), row[0], row[18] || reservationDateKey_(row[0]), row[2], row[1],
      row[3], row[4], row[5], row[6], row[7], row[8], row[11], row[19] || 'HARI_INI', event]);
  } catch (e) { console.error('Request event failed: ' + row[11] + ' ' + event); }
}

function legacyFingerprint_(row) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(row)));
}

function legacyCandidate_(row) {
  var marker = function(v) { return String(v || '').trim().toLowerCase() === 'slot kosong'; };
  return marker(row[3]) && (!DOCUMENT_TYPES[row[2]] || !DOCUMENT_TYPES[row[2]].requiresRouting ||
    (marker(row[4]) && marker(row[5])));
}

function reviewLegacySlots() {
  assertAdmin_();
  var review = reservationSheet_(RESERVATION.REVIEW,
    ['Sheet Sumber', 'ID Permintaan Lama', 'Nomor', 'Jenis', 'Tanggal', 'Hasil', 'Setujui', 'Sidik Data', 'Diimpor']);
  var known = reservationRows_(review, 9);
  var sources = getSpreadsheet_().getSheets().filter(function(s) {
    return s.getName() === APP.DATA_SHEET || /^ARSIP_PERMINTAAN_\d{4}$/.test(s.getName());
  });
  var all = [];
  sources.forEach(function(s) { reservationRows_(s, REQUEST_HEADERS.length).forEach(function(r) { all.push({sheet:s, values:r}); }); });
  all.forEach(function(item) {
    var r = item.values;
    if (r[10] === REQUEST_STATUS.RESERVED || ![r[3],r[4],r[5]].some(function(v) {
      return String(v || '').trim().toLowerCase() === 'slot kosong';
    })) return;
    var hash = legacyFingerprint_(r);
    if (known.some(function(k) { return k[7] === hash; })) return;
    var key = ''; try { key = reservationDateKey_(r[0]); } catch (e) {}
    var unique = all.filter(function(x) { var v=x.values;
      return Number(v[1]) === Number(r[1]) && v[2] === r[2] && Number(v[12]) === Number(r[12]);
    }).length === 1;
    var safe = legacyCandidate_(r) && DOCUMENT_TYPES[r[2]] && isPositiveInteger_(Number(r[1])) &&
      key && Number(key.slice(0,4)) === Number(r[12]) && r[11] && unique &&
      [REQUEST_STATUS.CANCELLED, REQUEST_STATUS.UPLOADING].indexOf(r[10]) === -1;
    review.appendRow([item.sheet.getName(), r[11], r[1], r[2], key,
      safe ? 'SIAP_DITINJAU' : 'PERIKSA_MANUAL', false, hash, '']);
  });
  getSpreadsheet_().setActiveSheet(review);
}

function importApprovedLegacySlots() {
  assertAdmin_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var review = getRequiredSheet_(RESERVATION.REVIEW);
    var target = getRequiredSheet_(APP.DATA_SHEET);
    var ledger = getRequiredSheet_(RESERVATION.SLOTS);
    reservationRows_(review, 9).forEach(function(r, i) {
      if (r[5] !== 'SIAP_DITINJAU' || String(r[6]).toLowerCase() !== 'true' || r[8]) return;
      var source = getRequiredSheet_(r[0]);
      var rows = reservationRows_(source, REQUEST_HEADERS.length);
      var index = rows.findIndex(function(v) { return v[11] === r[1]; });
      if (index < 0 || legacyFingerprint_(rows[index]) !== r[7]) {
        review.getRange(i+2, 6).setValue('DATA_BERUBAH_TINJAU_ULANG'); return;
      }
      if (source.getName() !== APP.DATA_SHEET) {
        review.getRange(i+2, 6).setValue('ARSIP_PERLU_PEMINDAHAN_ADMIN'); return;
      }
      var old = rows[index];
      var duplicate = rows.filter(function(v) { return v[2]===old[2] && Number(v[1])===Number(old[1]) && Number(v[12])===Number(old[12]); });
      if (duplicate.length !== 1) throw new Error('Nomor ganda ditemukan saat impor.');
      var id = 'LEGACY-' + old[11];
      if (!reservationRows_(ledger, SLOT_HEADERS.length).some(function(v) { return v[0] === id; })) {
        ledger.appendRow([id, r[4], old[2], old[1], 'SLOT_LAMA', new Date(), '', '', old[9]]);
      }
      var slot = old.slice();
      slot[10] = REQUEST_STATUS.RESERVED; slot[11] = id;
      slot[15] = ''; slot[16] = ''; slot[17] = new Date(); slot[18] = r[4]; slot[19] = 'RESERVASI';
      target.getRange(index+2, 1, 1, slot.length).setValues([slot]);
      review.getRange(i+2, 9).setValue(new Date());
    });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}
