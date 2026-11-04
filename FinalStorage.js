/* Private production storage. Existing request rows and counters are never migrated or rewritten. */
var FINAL_STORAGE_CACHE_ = null;
var FINAL_LEDGER_BOOK_ = null;

function finalStorageReady_() {
  return PropertiesService.getScriptProperties().getProperty('FINAL_PROD_READY') === '1';
}

function finalStorageConfig_() {
  if (!FINAL_STORAGE_CACHE_) {
    var p = PropertiesService.getScriptProperties();
    if (p.getProperty('FINAL_PROD_READY') !== '1') throw new Error('Penyimpanan surat final sedang dipersiapkan. Silakan muat ulang halaman.');
    FINAL_STORAGE_CACHE_ = {rootId:p.getProperty('FINAL_PROD_ROOT_ID'),ledgerId:p.getProperty('FINAL_PROD_LEDGER_ID')};
    if (!FINAL_STORAGE_CACHE_.rootId || !FINAL_STORAGE_CACHE_.ledgerId) throw new Error('Konfigurasi surat final belum lengkap. Hubungi admin.');
  }
  return FINAL_STORAGE_CACHE_;
}

function finalLedgerBook_() {
  if (!FINAL_LEDGER_BOOK_) {
    var id = finalStorageConfig_().ledgerId;
    if (DriveApp.getFileById(id).getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Catatan surat final harus privat. Hubungi admin.');
    FINAL_LEDGER_BOOK_ = SpreadsheetApp.openById(id);
  }
  return FINAL_LEDGER_BOOK_;
}

function ensureFinalProduction_() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('FINAL_PROD_READY') === '1') return true;
  var claim = Utilities.getUuid(), lock = LockService.getScriptLock();
  // Only claim/finalize use the request lock; slow Drive operations never block numbering.
  lock.waitLock(1000);
  try {
    if (p.getProperty('FINAL_PROD_READY') === '1') return true;
    if (Number(p.getProperty('FINAL_PROD_SETUP_UNTIL') || 0) > Date.now()) return false;
    p.setProperty('FINAL_PROD_SETUP_CLAIM',claim);
    p.setProperty('FINAL_PROD_SETUP_UNTIL',String(Date.now()+10*60*1000));
  } finally { lock.releaseLock(); }
  try {
    if (!p.getProperty('FINAL_PROD_BACKUP_ID')) {
      var backup = DriveApp.getFileById(APP.SPREADSHEET_ID).makeCopy('SIDDIQ Cadangan sebelum Surat Final '+Utilities.formatDate(new Date(),APP.TIMEZONE,'yyyy-MM-dd HHmmss'));
      p.setProperty('FINAL_PROD_BACKUP_ID',backup.getId());
    }
    DriveApp.getFileById(p.getProperty('FINAL_PROD_BACKUP_ID')).setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
    var rootId = p.getProperty('FINAL_PROD_ROOT_ID');
    if (!rootId) {
      var root = DriveApp.createFolder('SIDDIQ Surat Final — Privat');
      rootId = root.getId(); p.setProperty('FINAL_PROD_ROOT_ID',rootId);
    }
    var folder = DriveApp.getFolderById(rootId);
    if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Folder final harus privat.');
    var ledgerId = p.getProperty('FINAL_PROD_LEDGER_ID');
    if (!ledgerId) {
      ledgerId = SpreadsheetApp.create('SIDDIQ Ledger Surat Final — Privat').getId();
      p.setProperty('FINAL_PROD_LEDGER_ID',ledgerId);
    }
    var ledgerFile = DriveApp.getFileById(ledgerId);
    ledgerFile.moveTo(folder);
    if (ledgerFile.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Ledger final harus privat.');
    var book = SpreadsheetApp.openById(ledgerId);
    book.setSpreadsheetTimeZone(APP.TIMEZONE);
    [{name:FINAL_SHEET,headers:FINAL_HEADERS},{name:'LOG_SURAT_FINAL',headers:['Waktu','ID Permintaan','Tindakan','Alasan']}].forEach(function(spec) {
      var sheet = book.getSheetByName(spec.name) || book.insertSheet(spec.name);
      if (sheet.getLastRow() && sheet.getRange(1,1,1,spec.headers.length).getValues()[0].some(function(v,i){return v !== spec.headers[i];})) throw new Error('Header ledger final tidak sesuai.');
      sheet.getRange(1,1,1,spec.headers.length).setValues([spec.headers]);
      sheet.setFrozenRows(1);
    });
    SpreadsheetApp.flush();
    lock.waitLock(1000);
    try {
      if (p.getProperty('FINAL_PROD_SETUP_CLAIM') !== claim) throw new Error('Sesi penyiapan telah berubah.');
      p.setProperty('FINAL_PROD_READY','1');
    } finally { lock.releaseLock(); }
    return true;
  } finally {
    if (p.getProperty('FINAL_PROD_SETUP_CLAIM') === claim) {
      p.deleteProperty('FINAL_PROD_SETUP_CLAIM');p.deleteProperty('FINAL_PROD_SETUP_UNTIL');
    }
  }
}
