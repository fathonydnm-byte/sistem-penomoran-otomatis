// Durable private job ledger. Script Properties remain read-only legacy fallback.
// Construct outside the job lock; get/set are called with an active per-token lease.
function letterDraftJobStore_(token) {
  var book=finalLedgerBook_(), props=PropertiesService.getScriptProperties();
  var sheet=book.getSheetByName('GENERATOR_JOBS');
  if(!sheet) sheet=letterDraftLock_(function() {
    // The pre-lock Spreadsheet object can cache an absent sheet. A property
    // checkpoint and a fresh handle avoid competing first-use insertSheet calls.
    var id=props.getProperty('LETTER_DRAFT_JOB_SHEET_ID');
    var fresh=SpreadsheetApp.openById(book.getId());
    var s=id?fresh.getSheetById(Number(id)):fresh.getSheetByName('GENERATOR_JOBS');
    if(!s) {
      s=fresh.insertSheet('GENERATOR_JOBS');
      s.getRange(1,1,1,3).setValues([['Token','Status JSON','Diperbarui']]);
      SpreadsheetApp.flush();
    }
    props.setProperty('LETTER_DRAFT_JOB_SHEET_ID',String(s.getSheetId()));
    return s;
  });
  var row=0, legacyKey='LETTER_DRAFT_'+token;
  function locate() {
    if(row && String(sheet.getRange(row,1).getValues()[0][0])===token) return row;
    var last=sheet.getLastRow();
    var matches=last<2?[]:sheet.getRange(2,1,last-1,1).createTextFinder(token).matchEntireCell(true).findAll();
    if(matches.length>1) throw Error('Catatan proses ganda. Hubungi admin.');
    if(row && !matches.length) throw Error('Catatan proses telah dipindah atau dihapus. Hubungi admin.');
    row=matches.length?matches[0].getRow():0;
    return row;
  }
  return {
    get:function() {
      return JSON.parse(locate()?sheet.getRange(row,2).getValues()[0][0]:(props.getProperty(legacyKey)||'{}'));
    },
    set:function(job) {
      // Initial insertion happens under the existing ScriptLock. Later saves update
      // only this token's row, never append using a stale row index.
      if(!locate()) row=sheet.getLastRow()+1;
      var json=JSON.stringify(job);
      if(json.length>45000) throw Error('Data proses terlalu panjang. Hubungi admin.');
      sheet.getRange(row,1,1,3).setValues([[token,json,new Date()]]);
      SpreadsheetApp.flush();
      // No deletion is required for migration: ledger wins on all subsequent reads.
    }
  };
}
