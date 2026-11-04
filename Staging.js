/* This branch is staging-only. Never merge these provisioning guards into production. */
function stagingProps_() { return PropertiesService.getScriptProperties(); }
function assertStagingProject_() {
  if (ScriptApp.getScriptId() === '1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_') throw new Error('STOP: kode staging tidak boleh berjalan pada project produksi.');
}
function bindFinalStaging_() {
  assertStagingProject_();
  var p=stagingProps_();
  APP.SPREADSHEET_ID=p.getProperty('FINAL_STAGING_SHEET')||'';
  APP.ROOT_FOLDER_ID=p.getProperty('FINAL_STAGING_ROOT')||'';
  APP.WEB_APP_URL=ScriptApp.getService().getUrl()||'';
}
function ensureFinalStaging_() {
  bindFinalStaging_();
  if(stagingProps_().getProperty('FINAL_STAGING_READY')==='1')return;
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var p=stagingProps_();if(p.getProperty('FINAL_STAGING_READY')==='1'){bindFinalStaging_();return;}
    var rootId=p.getProperty('FINAL_STAGING_ROOT');
    if(!rootId){rootId=DriveApp.createFolder('SIDDIQ UJI FINAL SURAT — DATA BUATAN').getId();p.setProperty('FINAL_STAGING_ROOT',rootId);}
    var sheetId=p.getProperty('FINAL_STAGING_SHEET');
    if(!sheetId){sheetId=SpreadsheetApp.create('SIDDIQ UJI FINAL SURAT — DATA BUATAN').getId();p.setProperty('FINAL_STAGING_SHEET',sheetId);DriveApp.getFileById(sheetId).moveTo(DriveApp.getFolderById(rootId));}
    bindFinalStaging_();SPREADSHEET_INSTANCE_=null;
    var book=getSpreadsheet_();book.setSpreadsheetTimeZone(APP.TIMEZONE);
    ensureRequiredSheets_(book);ensureHeaders_(book);ensureDefaultSettings_(book);
    var finalId=p.getProperty('FINAL_STAGING_FINAL_ROOT');
    if(!finalId){finalId=DriveApp.getFolderById(rootId).createFolder('Final Privat UJI').getId();p.setProperty('FINAL_STAGING_FINAL_ROOT',finalId);}
    var settings=book.getSheetByName(APP.SETTINGS_SHEET);
    if(!getSettings_().rowByKey.FINAL_ROOT_FOLDER_ID)settings.appendRow(['FINAL_ROOT_FOLDER_ID',finalId,'Folder privat final UJI']);
    setSettingValues_({BULK_ACCESS_CODE:'UJI-SIDDIQ-2026',NEXT_SURAT_DINAS:9001,NEXT_NOTA_DINAS:9001,NEXT_SK_SE:9001});
    [FINAL_SHEET,'LOG_SURAT_FINAL'].forEach(function(name){var s=book.getSheetByName(name)||book.insertSheet(name);var h=name===FINAL_SHEET?FINAL_HEADERS:['Waktu','ID Permintaan','Tindakan','Alasan'];s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);});
    var sheet=getRequiredSheet_(APP.DATA_SHEET);
    if(sheet.getLastRow()===1){
      var now=new Date();var fixtures=[['Pemohon Uji Satu','Surat Dinas','AKTIF','HARI_INI'],['Uji Satu','Nota Dinas','UPLOAD_GAGAL','MUNDUR'],['Pemohon Uji Dua','SK/SE','AKTIF','MASSAL'],['Pemohon Uji Satu','Surat Dinas','DIBATALKAN','HARI_INI'],['SISTEM','Nota Dinas','SLOT_TERSEDIA','RESERVASI'],['Pemohon Uji Dua','Nota Dinas','MENUNGGU_UPLOAD','MASSAL']];
      var rows=fixtures.map(function(f,i){var row=Array(REQUEST_HEADERS.length).fill('');row[0]=new Date(now.getTime()-(i+1)*86400000);row[1]=8001+i;row[2]=f[1];row[3]=i===4?'Slot Kosong':'PERIHAL UJI RAHASIA '+i;row[4]='Dari Uji';row[5]='Kepada Uji';row[6]=f[0];row[7]='Bagian Umum';row[10]=f[2];row[11]='fixture-final-'+i;row[12]=Number(finalDate_(row[0],false).slice(0,4));row[15]='dummy-token-'+i;row[18]=finalDate_(row[0],false);row[19]=f[3];row[20]=now;return row;});
      sheet.getRange(2,1,rows.length,REQUEST_HEADERS.length).setValues(rows);
    }
    p.setProperty('FINAL_STAGING_READY','1');
  } finally {lock.releaseLock();}
}
// Every google.script.run execution receives the staging resource IDs before entry.
if (typeof ScriptApp !== 'undefined' && typeof APP !== 'undefined') bindFinalStaging_();

function stagingDummyPdf(payload) {
  assertStagingProject_();var sample=payload&&payload.sample==='B'?'B':'A';
  var stream='BT /F1 16 Tf 50 780 Td (SIDDIQ FINAL SURAT UJI '+sample+') Tj 0 -28 Td /F1 11 Tf (Data buatan - bukan surat resmi - tidak bertanda tangan) Tj ET';
  var objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  var text='%PDF-1.4\n',offsets=[0];objects.forEach(function(o,i){offsets.push(text.length);text+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
  var xref=text.length;text+='xref\n0 6\n0000000000 65535 f \n';offsets.slice(1).forEach(function(n){text+=('0000000000'+n).slice(-10)+' 00000 n \n';});text+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return {name:'SIDDIQ_DUMMY_'+sample+'.pdf',base64:Utilities.base64Encode(Utilities.newBlob(text).getBytes())};
}
