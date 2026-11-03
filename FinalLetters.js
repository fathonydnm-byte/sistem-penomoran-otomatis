/* Final-letter ledger is separate from request/upload status. No production migration on read. */
var FINAL_HEADERS = ['ID Permintaan','ID File Final','Nama File','Ukuran Byte','Diunggah Pada',
  'Diperbarui Pada','Hash PDF','Klaim Upload','Klaim Berakhir','Versi','Kesalahan Terakhir'];
var FINAL_SHEET = 'SURAT_FINAL';

function finalSheet_() {
  return getRequiredSheet_(FINAL_SHEET);
}
function finalRows_() { return reservationRows_(finalSheet_(), FINAL_HEADERS.length); }
function finalRequests_() {
  return reservationRows_(getRequiredSheet_(APP.DATA_SHEET), REQUEST_HEADERS.length).filter(function(r) {
    return r[11] && DOCUMENT_TYPES[r[2]] &&
      [REQUEST_STATUS.RESERVED, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.FAILED].indexOf(r[10]) === -1 &&
      String(r[3] || '').trim().toLowerCase() !== 'slot kosong';
  });
}
function finalRequest_(id) {
  var found = finalRequests_().filter(function(r) { return String(r[11]) === String(id); });
  if (found.length !== 1) throw new Error('Permintaan tidak tersedia untuk pelengkapan final.');
  return found[0];
}
function finalRecord_(id, rows) {
  var result = null;
  (rows || finalRows_()).some(function(r, i) {
    if (String(r[0]) !== String(id)) return false;
    result = {row:i+2, values:r.slice()}; return true;
  });
  return result;
}
function finalDate_(v, time) {
  if (!v) return '';
  if (!time && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, APP.TIMEZONE, time ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
}
function publicFinalLetters(payload) {
  payload = payload || {};
  var requests = finalRequests_();
  var names = requests.map(function(r) { return String(r[6] || ''); }).filter(function(n,i,a) { return n && a.indexOf(n) === i; }).sort();
  var name = String(payload.applicantName || '');
  if (!name) return {names:names,items:[],total:0};
  var ledger = finalRows_();
  var filtered = requests.filter(function(r) { return String(r[6] || '') === name; });
  filtered.sort(function(a,b) { return String(finalDate_(b[20] || b[0], true)).localeCompare(finalDate_(a[20] || a[0], true)) || Number(b[1])-Number(a[1]); });
  var page = Math.max(0, Math.floor(Number(payload.page) || 0));
  return {names:names,total:filtered.length,page:page,items:filtered.slice(page*50,page*50+50).map(function(r) {
    var f = finalRecord_(r[11], ledger);
    // Explicit allowlist: never return subject, draft URLs, final URLs, unit, tokens, or file metadata.
    return {requestId:String(r[11]),number:r[1],documentType:String(r[2]),letterDate:finalDate_(r[18] || r[0],false),
      requestedAt:finalDate_(r[20] || r[0],true),complete:!!(f && f.values[1])};
  })};
}
function validateFinalPdf_(blob) {
  if (!blob || typeof blob.getBytes !== 'function') throw new Error('Pilih file PDF final.');
  var bytes = blob.getBytes();
  if (!bytes.length || bytes.length > 20*1024*1024) throw new Error('PDF final harus berukuran lebih dari 0 dan maksimal 20 MB.');
  if (!/\.pdf$/i.test(blob.getName()) || bytes.slice(0,1024).map(function(x) {return String.fromCharCode((x+256)%256);}).join('').indexOf('%PDF-') === -1) {
    throw new Error('File harus berupa PDF yang valid.');
  }
  return {blob:blob,bytes:bytes,size:bytes.length,name:cleanFileName_(blob.getName()),
    hash:Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(x){return ('0'+((x+256)%256).toString(16)).slice(-2);}).join('')};
}
function finalLock_(fn) {
  var lock = LockService.getScriptLock();lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function claimFinal_(id, pdf, admin) {
  return finalLock_(function() {
    var request = finalRequest_(id), rows=finalRows_(), record=finalRecord_(id,rows), now=new Date();
    var v=record ? record.values : [id,'','','','','','','','',0,''];
    if (v[7] && new Date(v[8]).getTime()>now.getTime()) throw new Error('Surat sedang diunggah. Tunggu sebelum mencoba lagi.');
    if (v[1] && !admin) {
      if (v[6] === pdf.hash) return {alreadyComplete:true};
      throw new Error('Final sudah dilengkapi. Penggantian hanya dapat dilakukan admin.');
    }
    if (rows.some(function(r) { return r[0] !== id && r[6] === pdf.hash && (r[1] || (r[7] && new Date(r[8]).getTime()>now.getTime())); })) {
      throw new Error('PDF yang sama sudah digunakan atau sedang diunggah untuk nomor lain. Satu PDF untuk satu nomor.');
    }
    var previousHash=v[6];
    var claim=Utilities.getUuid();
    v[6]=pdf.hash;v[7]=claim;v[8]=new Date(now.getTime()+20*60*1000);v[10]='';
    var row=record ? record.row : finalSheet_().getLastRow()+1;
    finalSheet_().getRange(row,1,1,FINAL_HEADERS.length).setValues([v]);SpreadsheetApp.flush();
    return {claim:claim,request:request,oldFileId:v[1],previousHash:previousHash,version:Number(v[9]||0)};
  });
}
function finalRoot_() {
  var id=String(getSettings_().values.FINAL_ROOT_FOLDER_ID || '');
  if (!id) throw new Error('Folder final belum dikonfigurasi oleh admin.');
  var folder=DriveApp.getFolderById(id);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Folder final harus privat. Hubungi admin.');
  return folder;
}
function finalPrivateChild_(parent,name) {
  var folder=getOrCreateFolder_(parent,name);
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('Subfolder final harus privat. Hubungi admin.');
  return folder;
}
function uploadFinalLetter(form) {
  form=form || {};
  var admin=!!form.adminToken;
  if (admin) validateBulkAccessToken_(form.adminToken);
  var id=cleanText_(form.finalRequestId,120), pdf=validateFinalPdf_(form.finalPdf);
  if (!id) throw new Error('Pilih nomor surat terlebih dahulu.');
  var claim=claimFinal_(id,pdf,admin);
  if (claim.alreadyComplete) return {success:true,complete:true};
  var file=null, committed=false;
  try {
    var r=claim.request;
    var folder=finalPrivateChild_(finalPrivateChild_(finalPrivateChild_(finalRoot_(),String(r[12])),String(r[2])),'Final');
    file=folder.createFile(pdf.blob);
    file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);
    file.setName(cleanFileName_('FINAL - '+r[2]+' - '+r[1]+' - '+r[12]+' - '+r[3])+'.pdf');
    finalLock_(function() {
      finalRequest_(id); // Cancellation while uploading must not complete the request.
      var f=finalRecord_(id);
      if (!f || f.values[7] !== claim.claim) throw new Error('Sesi unggah sudah berubah. Muat ulang daftar surat.');
      if (admin) validateBulkAccessToken_(form.adminToken);
      var now=new Date(),v=f.values;
      v[1]=file.getId();v[2]=file.getName();v[3]=pdf.size;v[4]=now;v[5]=now;
      v[6]=pdf.hash;v[7]='';v[8]='';v[9]=claim.version+1;v[10]='';
      finalSheet_().getRange(f.row,1,1,FINAL_HEADERS.length).setValues([v]);SpreadsheetApp.flush();
      committed=true;
      finalAudit_(id,admin ? 'FINAL_ADMIN_DISIMPAN' : 'FINAL_DISIMPAN','');
    });
    if (claim.oldFileId && claim.oldFileId !== file.getId()) {
      try { DriveApp.getFileById(claim.oldFileId).setTrashed(true); } catch(e) { console.error('Final lama perlu dibersihkan oleh admin: '+id); }
    }
    return {success:true,complete:true};
  } catch(error) {
    if (!committed && file) { try { file.setTrashed(true); } catch(e) {} }
    if (!committed) finalLock_(function() {
      var f=finalRecord_(id);
      if (f && f.values[7] === claim.claim) {
        f.values[6]=claim.previousHash;f.values[7]='';f.values[8]='';f.values[10]='Upload gagal; dapat dicoba kembali.';
        finalSheet_().getRange(f.row,1,1,FINAL_HEADERS.length).setValues([f.values]);
      }
    });
    throw new Error('Final belum berhasil disimpan. Muat ulang daftar, lalu coba kembali.');
  }
}
function finalAudit_(id,action,reason) {
  try { getRequiredSheet_('LOG_SURAT_FINAL').appendRow([new Date(),id,action,cleanText_(reason,500)]); }
  catch(e) { console.error('Log final perlu diperiksa: '+id); }
}
function adminRemoveFinal(payload) {
  validateBulkAccessToken_(payload && payload.accessToken);
  var reason=cleanText_(payload.reason,500);
  if (!reason) throw new Error('Alasan koreksi wajib diisi.');
  var old=finalLock_(function() {
    var f=finalRecord_(payload.requestId);
    if (!f || !f.values[1]) throw new Error('File final tidak ditemukan.');
    if (f.values[7] && new Date(f.values[8]).getTime()>new Date().getTime()) throw new Error('Upload sedang berlangsung.');
    var id=f.values[1];f.values[1]='';f.values[2]='';f.values[3]='';f.values[4]='';f.values[5]=new Date();f.values[6]='';f.values[7]='';f.values[8]='';f.values[9]=Number(f.values[9]||0)+1;
    finalSheet_().getRange(f.row,1,1,FINAL_HEADERS.length).setValues([f.values]);
    finalAudit_(payload.requestId,'FINAL_DILEPAS',reason);return id;
  });
  try { DriveApp.getFileById(old).setTrashed(true); } catch(e) { console.error('File final terlepas perlu dibersihkan admin.'); }
  return {success:true};
}
function finalFiltered_(payload) {
  payload=payload || {};
  var start=String(payload.startDate||''),end=String(payload.endDate||'');
  [start,end].filter(String).forEach(function(v){reservationDateKey_(v);});
  if(start && end && start>end)throw new Error('Rentang tanggal tidak valid.');
  var ledger=finalRows_();
  return finalRequests_().map(function(r) {
    var f=finalRecord_(r[11],ledger);
    return {requestId:String(r[11]),applicantName:String(r[6]),unit:String(r[7]),documentType:String(r[2]),number:r[1],
      letterDate:finalDate_(r[18]||r[0],false),requestedAt:finalDate_(r[20]||r[0],true),
      complete:!!(f&&f.values[1]),fileUrl:f&&f.values[1] ? 'https://drive.google.com/file/d/'+encodeURIComponent(f.values[1])+'/view' : ''};
  }).filter(function(r) {
    var date=r.requestedAt.slice(0,10);
    return (!payload.applicantName||r.applicantName===payload.applicantName)&&(!payload.unit||r.unit===payload.unit)&&
      (!payload.documentType||r.documentType===payload.documentType)&&(!payload.year||r.letterDate.slice(0,4)===String(payload.year))&&
      (!start||date>=start)&&(!end||date<=end)&&(!payload.status||(payload.status==='complete'?r.complete:!r.complete));
  });
}
function finalSummary_(items) {
  var groups={};
  items.forEach(function(r){var key='$'+r.applicantName;if(!groups[key])groups[key]={applicantName:r.applicantName,total:0,complete:0,incomplete:0};var g=groups[key];g.total++;g[r.complete?'complete':'incomplete']++;});
  return Object.keys(groups).map(function(k){return groups[k];}).sort(function(a,b){return a.applicantName.localeCompare(b.applicantName);});
}
function adminFinalLetters(payload) {
  validateBulkAccessToken_(payload && payload.accessToken);
  var items=finalFiltered_(payload),page=Math.max(0,Math.floor(Number(payload.page)||0));
  return {summary:finalSummary_(items),total:items.length,page:page,items:items.slice(page*50,page*50+50),
    units:UNIT_OPTIONS, names:publicFinalLetters({}).names};
}
function exportFinalReport(payload) {
  validateBulkAccessToken_(payload && payload.accessToken);
  if (['pdf','xlsx'].indexOf(payload.format)===-1) throw new Error('Format ekspor tidak valid.');
  var summary=finalSummary_(finalFiltered_(payload));
  if(summary.length>2000)throw new Error('Persempit filter laporan (maksimal 2.000 pemohon).');
  var book=null;
  try {
    book=SpreadsheetApp.create('Rekap Final Surat UJI '+Utilities.getUuid());
    var sheet=book.getSheets()[0];sheet.setName('Rekap Final Surat');
    var period=(payload.startDate||'Awal data')+' s.d. '+(payload.endDate||'Seluruh data');
    var filters=['Pemohon: '+(payload.applicantName||'Semua'),'Unit: '+(payload.unit||'Semua'),'Jenis: '+(payload.documentType||'Semua'),'Tahun surat: '+(payload.year||'Semua'),'Status: '+(payload.status||'Semua')].join(' | ');
    var rows=[['REKAP KELENGKAPAN FINAL SURAT','','','',''],['Periode pengajuan: '+period,'','','',''],['Dicetak: '+finalDate_(new Date(),true)+' WIB','','','',''],[filters,'','','',''],['Pemohon','Total Wajib','Sudah Lengkap','Belum Lengkap','Persentase Lengkap']];
    summary.forEach(function(g){rows.push(["'"+String(g.applicantName),g.total,g.complete,g.incomplete,g.total?g.complete/g.total:0]);});
    sheet.getRange(1,1,rows.length,5).setValues(rows);sheet.getRange(1,1,1,5).merge().setFontWeight('bold');
    [2,3,4].forEach(function(r){sheet.getRange(r,1,1,5).merge().setWrap(true);});
    sheet.getRange(5,1,1,5).setFontWeight('bold').setBackground('#e7f0ea');sheet.setFrozenRows(5);
    sheet.setColumnWidth(1,240);sheet.setColumnWidths(2,4,115);if(summary.length)sheet.getRange(6,5,summary.length,1).setNumberFormat('0.0%');
    SpreadsheetApp.flush();
    var mime=payload.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var url=payload.format==='pdf'?'https://docs.google.com/spreadsheets/d/'+book.getId()+'/export?format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=true':
      'https://www.googleapis.com/drive/v3/files/'+book.getId()+'/export?mimeType='+encodeURIComponent(mime);
    var response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw new Error('Layanan ekspor belum siap. Silakan coba lagi.');
    var bytes=response.getBlob().getBytes();if(bytes.length>10*1024*1024)throw new Error('Laporan terlalu besar. Persempit filter.');
    return {name:'Rekap_Final_Surat_'+finalDate_(new Date(),false)+'.'+payload.format,mimeType:mime,base64:Utilities.base64Encode(bytes)};
  } finally { if(book)DriveApp.getFileById(book.getId()).setTrashed(true); }
}
