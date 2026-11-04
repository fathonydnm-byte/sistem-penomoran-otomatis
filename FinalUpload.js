/* One MiB resumable packets. OAuth/session URLs stay server-side; no lock spans network I/O. */
var FINAL_PACKET_BYTES = 1024*1024;
var FINAL_RESUME_PREFIX = 'FINAL_RESUME_';
var FINAL_RESUME_TTL = 20*60*1000;

function finalResumeKey_(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token||''))) throw new Error('Sesi unggah tidak valid.');
  return FINAL_RESUME_PREFIX+token;
}
function finalResumeRead_(key) {
  var text=PropertiesService.getScriptProperties().getProperty(key);
  return text ? JSON.parse(text) : null;
}
function finalResumeSave_(key,job) { PropertiesService.getScriptProperties().setProperty(key,JSON.stringify(job)); }
function finalResumeView_(job) {
  return {success:true,complete:job.phase==='complete',receivedBytes:job.offset,totalBytes:job.size,
    chunkBytes:FINAL_PACKET_BYTES,readyToFinish:job.phase==='uploaded',phase:job.phase};
}
function finalResumeError_(message) { var e=new Error(message);e.finalTerminal=true;return e; }
function finalResumeRetry_(message) { return {success:false,retryable:true,message:message||'Layanan sedang sibuk. Paket akan dicoba kembali.'}; }
function finalResumeHeaders_(response,name) {
  var headers=response.getAllHeaders(),key=Object.keys(headers).filter(function(k){return k.toLowerCase()===name.toLowerCase();})[0];
  return key ? String(headers[key]) : '';
}
function finalDriveFetch_(url,options) {
  // Never accept a client-supplied URL or forward the bearer credential to another origin.
  if (!/^https:\/\/www\.googleapis\.com\/(upload\/)?drive\/v3\//.test(url)) throw finalResumeError_('Tujuan unggah tidak valid.');
  options=options||{};options.headers=options.headers||{};
  options.headers.Authorization='Bearer '+ScriptApp.getOAuthToken();
  options.muteHttpExceptions=true;options.followRedirects=false;
  var response=UrlFetchApp.fetch(url,options),code=response.getResponseCode();
  if (code===429 || code>=500 || (code===403 && /rateLimitExceeded|userRateLimitExceeded/.test(response.getContentText()))) throw new Error('Drive sementara sibuk.');
  return response;
}
function finalResumeFail_(key,job,message) {
  var committed=false;
  finalLock_(function(){
    var sheet=finalSheet_(),r=finalRecordAt_(job.id,job.ledgerRow,sheet);
    committed=!!(r && job.fileId && r.values[1]===job.fileId && r.values[6]===job.hash);
    if (committed) {job.phase='complete';job.offset=job.size;return;}
    if(r && r.values[7]===job.claim){
      r.values[6]=job.previousHash;r.values[7]='';r.values[8]='';r.values[10]='Unggah terhenti; dapat dicoba kembali.';
      sheet.getRange(r.row,1,1,FINAL_HEADERS.length).setValues([r.values]);SpreadsheetApp.flush();
    }
    job.phase='failed';job.failure=message;job.expires=Date.now()+2*60*1000;
  });
  if(!committed && job.fileId){try{DriveApp.getFileById(job.fileId).setTrashed(true);}catch(e){/* An unfinished Drive session may not have created its file. */}}
  finalResumeSave_(key,job);
}
function finalResumeSweep_() {
  var props=PropertiesService.getScriptProperties(),all=props.getProperties(),count=0;
  Object.keys(all).filter(function(k){return k.indexOf(FINAL_RESUME_PREFIX)===0;}).some(function(key){
    var job=JSON.parse(all[key]);if(job.expires>Date.now()||job.leaseUntil>Date.now())return false;
    if(job.phase!=='complete'&&job.phase!=='failed')finalResumeFail_(key,job,'Sesi unggah kedaluwarsa.');
    props.deleteProperty(key);return ++count>=3;
  });
}
function finalResumeWith_(token,operation) {
  var key=finalResumeKey_(token),lease=Utilities.getUuid();
  var job=finalLock_(function(){
    var j=finalResumeRead_(key);if(!j)return null;
    if(j.leaseUntil>Date.now())return {busy:true};
    j.lease=lease;j.leaseUntil=Date.now()+7*60*1000;finalResumeSave_(key,j);return j;
  });
  if(!job)return {success:false,restart:true,message:'Sesi unggah tidak tersedia. Klik unggah untuk mulai kembali.'};
  if(job.busy)return finalResumeRetry_('Paket sebelumnya masih diproses. Menunggu konfirmasi server.');
  try {
    if(job.phase==='complete')return finalResumeView_(job);
    if(job.phase==='failed')return {success:false,restart:true,message:job.failure||'Sesi perlu dimulai kembali.'};
    if(job.expires<Date.now())throw finalResumeError_('Sesi unggah kedaluwarsa. Mulai kembali dengan file yang sama.');
    var result=operation(job,key);
    job.expires=Date.now()+(job.phase==='complete'?60*60*1000:FINAL_RESUME_TTL);
    return result || finalResumeView_(job);
  } catch(error) {
    if(error.finalTerminal){finalResumeFail_(key,job,error.message);if(job.phase==='complete')return finalResumeView_(job);return {success:false,restart:true,message:error.message};}
    return finalResumeRetry_('Konfirmasi paket belum diterima. Mencoba melanjutkan posisi terakhir.');
  } finally {
    finalLock_(function(){var current=finalResumeRead_(key);if(current&&current.lease===lease){job.lease='';job.leaseUntil=0;finalResumeSave_(key,job);}});
  }
}
function finalResumeRenew_(job) {
  if(Date.now()-job.renewedAt<5*60*1000)return;
  finalLock_(function(){
    var sheet=finalSheet_(),r=finalRecordAt_(job.id,job.ledgerRow,sheet);
    if(!r||r.values[7]!==job.claim)throw finalResumeError_('Nomor surat sedang ditangani sesi lain. Muat ulang daftar.');
    r.values[8]=new Date(Date.now()+FINAL_RESUME_TTL);sheet.getRange(r.row,1,1,FINAL_HEADERS.length).setValues([r.values]);SpreadsheetApp.flush();
    job.renewedAt=Date.now();
  });
}
function finalResumeInit_(job) {
  if(job.phase!=='starting')return;
  if(!job.folderId){
    var folder=finalPrivateChild_(finalPrivateChild_(finalPrivateChild_(finalRoot_(),job.year),job.type),'Final');
    job.folderId=folder.getId();
  }
  if(!job.fileId){var ids=Drive.Files.generateIds({count:1,space:'drive',type:'files'});job.fileId=ids.ids[0];}
  var response=finalDriveFetch_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,mimeType',{
    method:'post',contentType:'application/json',headers:{'X-Upload-Content-Type':'application/pdf','X-Upload-Content-Length':String(job.size)},
    payload:JSON.stringify({id:job.fileId,name:job.filename,mimeType:'application/pdf',parents:[job.folderId]})});
  if(response.getResponseCode()!==200)throw finalResumeError_('Layanan unggah Drive belum siap. Silakan hubungi admin.');
  var url=finalResumeHeaders_(response,'Location');
  if(!/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\//.test(url))throw finalResumeError_('Sesi Drive tidak valid. Coba kembali.');
  job.url=url;job.phase='uploading';
}
function finalResumeResponse_(job,response) {
  var code=response.getResponseCode();
  if(code===308){
    var range=finalResumeHeaders_(response,'Range'),match=/^bytes=0-(\d+)$/.exec(range);
    var offset=match?Number(match[1])+1:0;
    if(!Number.isSafeInteger(offset)||offset<job.offset||offset>job.size)throw finalResumeError_('Posisi paket tidak sesuai. Mulai kembali.');
    job.offset=offset;job.dirty=false;return;
  }
  if(code===200||code===201){
    var info=JSON.parse(response.getContentText());
    if(info.id!==job.fileId||Number(info.size)!==job.size)throw finalResumeError_('Ukuran hasil unggah tidak sesuai. Mulai kembali.');
    job.offset=job.size;job.phase='uploaded';job.dirty=false;return;
  }
  throw finalResumeError_(code===404||code===410?'Sesi Drive kedaluwarsa. Klik unggah untuk mulai kembali.':'Paket ditolak Drive. Klik unggah untuk mulai kembali.');
}
function finalResumeSync_(job) {
  var response=finalDriveFetch_(job.url,{method:'put',payload:'',headers:{'Content-Range':'bytes */'+job.size}});
  if(response.getResponseCode()===404||response.getResponseCode()===410){
    // A lost final response can outlive its session URI. The pre-generated file ID resolves it safely.
    var check=finalDriveFetch_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(job.fileId)+'?fields=id,size,mimeType,trashed',{method:'get'});
    if(check.getResponseCode()===200){var info=JSON.parse(check.getContentText());if(!info.trashed&&Number(info.size)===job.size){finalResumeResponse_(job,check);return;}}
  }
  finalResumeResponse_(job,response);
}
function startFinalUpload(payload) {
  payload=payload||{};var key=finalResumeKey_(payload.uploadToken),id=cleanText_(payload.requestId,120),size=Number(payload.size),hash=String(payload.hash||'');
  if(!id||!Number.isSafeInteger(size)||size<1||size>20*1024*1024||!/\.pdf$/i.test(String(payload.name||''))||!/^[a-f0-9]{64}$/.test(hash))throw new Error('Pilih PDF yang valid, maksimal 20 MB.');
  var header=Utilities.base64Decode(String(payload.header||'').slice(0,1368));
  if(header.length>1024||header.map(function(b){return String.fromCharCode((b+256)%256);}).join('').indexOf('%PDF-')===-1)throw new Error('File harus berupa PDF yang valid.');
  var admin=!!payload.adminToken;if(admin)validateBulkAccessToken_(payload.adminToken);
  finalResumeSweep_();
  finalLock_(function(){
    var existing=finalResumeRead_(key);
    if(existing){if(existing.id!==id||existing.hash!==hash||existing.size!==size||existing.admin!==admin)throw new Error('Sesi berbeda dari file yang dipilih.');return;}
    var all=PropertiesService.getScriptProperties().getProperties();
    var active=Object.keys(all).filter(function(k){if(k.indexOf(FINAL_RESUME_PREFIX)!==0)return false;var j=JSON.parse(all[k]);return j.phase!=='complete'&&j.phase!=='failed'&&j.expires>Date.now();}).length;
    if(active>=20)throw new Error('Sistem sedang melayani unggahan lain. Coba beberapa saat lagi.');
    var claim=claimFinalUnlocked_(id,{hash:hash},admin),r=claim.request;
    var job={id:id,hash:hash,size:size,admin:admin,offset:claim.alreadyComplete?size:0,phase:claim.alreadyComplete?'complete':'starting',expires:Date.now()+FINAL_RESUME_TTL,renewedAt:Date.now()};
    if(r){job.claim=claim.claim;job.requestRow=claim.requestRow;job.ledgerRow=claim.ledgerRow;job.oldFileId=claim.oldFileId;job.previousHash=claim.previousHash;job.version=claim.version;job.year=String(r[12]);job.type=String(r[2]);job.filename=cleanFileName_('FINAL - '+r[2]+' - '+r[1]+' - '+r[12]+' - '+r[3])+'.pdf';}
    finalResumeSave_(key,job);
  });
  return finalResumeWith_(payload.uploadToken,function(job){finalResumeInit_(job);});
}
function sendFinalUploadChunk(payload) {
  payload=payload||{};var offset=Number(payload.offset),data=String(payload.data||'');
  if(!Number.isSafeInteger(offset)||offset<0||data.length>Math.ceil(FINAL_PACKET_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('Paket unggahan tidak valid.');
  return finalResumeWith_(payload.uploadToken,function(job,key){
    finalResumeInit_(job);finalResumeRenew_(job);
    if(job.dirty)finalResumeSync_(job);
    if(job.phase==='uploaded'||offset!==job.offset)return;
    var bytes=Utilities.base64Decode(data);
    if(!bytes.length||bytes.length>FINAL_PACKET_BYTES||offset+bytes.length>job.size||(offset+bytes.length<job.size&&bytes.length%(256*1024)!==0))throw finalResumeError_('Ukuran paket unggahan tidak sesuai.');
    job.dirty=true;finalResumeSave_(key,job);
    var response=finalDriveFetch_(job.url,{method:'put',contentType:'application/pdf',payload:Utilities.newBlob(bytes),headers:{'Content-Range':'bytes '+offset+'-'+(offset+bytes.length-1)+'/'+job.size}});
    finalResumeResponse_(job,response);
  });
}
function finishFinalUpload(payload) {
  payload=payload||{};
  return finalResumeWith_(payload.uploadToken,function(job){
    if(job.admin)validateBulkAccessToken_(payload.adminToken);
    finalResumeInit_(job);if(job.dirty)finalResumeSync_(job);
    if(job.phase!=='uploaded')return finalResumeRetry_('File belum diterima seluruhnya. Lanjutkan paket yang tersisa.');
    var file=DriveApp.getFileById(job.fileId);
    if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||DriveApp.getFolderById(job.folderId).getSharingAccess()!==DriveApp.Access.PRIVATE)throw finalResumeError_('File final harus privat. Hubungi admin.');
    var pdf;try{pdf=validateFinalPdf_(file.getBlob());}catch(e){throw finalResumeError_('Pemeriksaan PDF gagal. Pilih PDF yang valid dan unggah kembali.');}
    if(pdf.size!==job.size||pdf.hash!==job.hash)throw finalResumeError_('Pemeriksaan file tidak cocok. Unggah kembali file yang sama.');
    finalLock_(function(){
      try{finalRequestAt_(job.id,job.requestRow);}catch(e){throw finalResumeError_('Permintaan tidak lagi tersedia untuk pelengkapan final.');}
      var sheet=finalSheet_(),r=finalRecordAt_(job.id,job.ledgerRow,sheet);
      if(r&&r.values[1]===job.fileId&&r.values[6]===job.hash){job.phase='complete';return;}
      if(!r||r.values[7]!==job.claim)throw finalResumeError_('Sesi surat telah berubah. Muat ulang daftar.');
      if(job.admin)validateBulkAccessToken_(payload.adminToken);
      var now=new Date(),v=r.values;v[1]=job.fileId;v[2]=job.filename;v[3]=job.size;v[4]=now;v[5]=now;v[6]=job.hash;v[7]='';v[8]='';v[9]=job.version+1;v[10]='';
      sheet.getRange(r.row,1,1,FINAL_HEADERS.length).setValues([v]);SpreadsheetApp.flush();job.phase='complete';
    });
    finalAudit_(job.id,job.admin?'FINAL_ADMIN_DISIMPAN':'FINAL_DISIMPAN','Unggah bertahap');
    if(job.oldFileId&&job.oldFileId!==job.fileId){try{DriveApp.getFileById(job.oldFileId).setTrashed(true);}catch(e){console.error('Final lama perlu diperiksa admin.');}}
  });
}
function cancelFinalUpload(payload) {
  return finalResumeWith_(payload&&payload.uploadToken,function(job,key){finalResumeFail_(key,job,'Unggah dibatalkan. Silakan pilih file kembali.');return {success:true,cancelled:true};});
}
