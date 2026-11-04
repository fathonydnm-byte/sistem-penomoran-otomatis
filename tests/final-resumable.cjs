const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const setup=fs.readFileSync(path.join(__dirname,'final-letters.cjs'),'utf8').split('let passed=0;function test')[0];
const harness=vm.createContext({require,__dirname,console,Buffer});vm.runInContext(setup+';globalThis.h={ctx,sheets,reset,request,pdf,files,folders};',harness);
const {ctx,sheets,reset:baseReset,request,files,folders}=harness.h;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../FinalUpload.js'),'utf8'),ctx);
if(process.env.DEBUG_RESUME){const run=ctx.finalResumeWith_;ctx.finalResumeWith_=(t,fn)=>run(t,(j,k)=>{try{return fn(j,k);}catch(e){console.error(e.stack);throw e;}});}
const props={},drive={},sessions={};let nextId=0,inFlight=0,maxInFlight=0,hook=null,lostAck=false,failFetch=false,failHash=false;
ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty(k,v){props[k]=v;},deleteProperty(k){delete props[k];},getProperties:()=>({...props})})};
ctx.Utilities.base64Decode=s=>Array.from(Buffer.from(s,'base64'));
ctx.Utilities.newBlob=bytes=>({getBytes:()=>bytes});
ctx.ScriptApp={getOAuthToken:()=> 'test-oauth-never-returned'};
ctx.Drive={Files:{generateIds:()=>({ids:['drive-'+ ++nextId]})}};
ctx.getOrCreateFolder_=(parent,name)=>{const id=parent.id+'/'+name;return folders[id]||(folders[id]={id,getId:()=>id,getSharingAccess:()=> 'PRIVATE'});};
const originalFiles=ctx.DriveApp.getFileById;
ctx.DriveApp.getFileById=id=>drive[id]||originalFiles(id);
function response(code,body={},headers={}){return{getResponseCode:()=>code,getContentText:()=>JSON.stringify(body),getAllHeaders:()=>headers};}
ctx.UrlFetchApp={fetch(url,opts){
 const key=url.match(/upload_id=([\w-]+)/)?.[1];assert(!/test-oauth/.test(url));
 if(opts.method==='post'){
   const meta=JSON.parse(opts.payload);sessions[meta.id]={meta,bytes:Buffer.alloc(0),size:Number(opts.headers['X-Upload-Content-Length'])};
   return response(200,{}, {Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id='+meta.id});
 }
 if(opts.method==='get'){const id=url.match(/\/files\/([^?]+)/)[1],file=drive[id];return file&&!file.trashed?response(200,{id,size:file.bytes.length,mimeType:'application/pdf'}):response(404);}
 assert.equal(opts.method,'put');const session=sessions[key];if(!session)return response(404);
 if(opts.headers['Content-Range'].startsWith('bytes */')){
   if(session.complete)return response(200,{id:key,size:session.size});
   return response(308,{},session.bytes.length?{Range:'bytes=0-'+(session.bytes.length-1)}:{});
 }
 if(failFetch){failFetch=false;throw Error('network interrupted');}
 inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
 try{
   if(hook){const fn=hook;hook=null;fn();}
   const start=Number(opts.headers['Content-Range'].match(/^bytes (\d+)-/)[1]);assert.equal(start,session.bytes.length,'No skipped/replayed bytes may reach Drive');
   session.bytes=Buffer.concat([session.bytes,Buffer.from(opts.payload.getBytes())]);
   if(session.bytes.length===session.size){
     session.complete=true;const bytes=Buffer.from(session.bytes),name=session.meta.name;
     drive[key]={bytes,trashed:false,getId:()=>key,getName:()=>name,getSharingAccess:()=> 'PRIVATE',setTrashed(v){this.trashed=v;},getBlob:()=>({getName:()=> name,getBytes:()=>Array.from(failHash?Buffer.from('%PDF-BROKEN'):bytes)})};
   }
   if(lostAck){lostAck=false;throw Error('response lost after Drive received packet');}
   return session.complete?response(200,{id:key,size:session.size}):response(308,{}, {Range:'bytes=0-'+(session.bytes.length-1)});
 }finally{inFlight--;}
}};
function reset(){baseReset();for(const o of [props,drive,sessions])Object.keys(o).forEach(k=>delete o[k]);nextId=0;inFlight=0;maxInFlight=0;hook=null;lostAck=false;failFetch=false;failHash=false;}
function file(label,size=1024*1024+37){const b=Buffer.alloc(size,32);b.write('%PDF-1.4\n'+label);return b;}
function meta(id,bytes,token='a'.repeat(32),adminToken=''){return {requestId:id,size:bytes.length,name:'final.pdf',hash:crypto.createHash('sha256').update(bytes).digest('hex'),header:bytes.subarray(0,1024).toString('base64'),uploadToken:token,adminToken};}
function packet(m,b,offset=0){return {uploadToken:m.uploadToken,offset,data:b.subarray(offset,Math.min(b.length,offset+1024*1024)).toString('base64')};}
function sendAll(m,b){let r=ctx.startFinalUpload(m);assert.equal(r.success,true);while(r.receivedBytes<b.length){r=ctx.sendFinalUploadChunk(packet(m,b,r.receivedBytes));assert.equal(r.success,true);}return ctx.finishFinalUpload({uploadToken:m.uploadToken,adminToken:m.adminToken});}
let passed=0;function test(name,fn){reset();fn();passed++;console.log('PASS '+name);}
test('packets advance by acknowledged bytes; completeness only after validation and commit',()=>{
 const b=file('one'),m=meta('one',b);const start=ctx.startFinalUpload(m);assert.equal(start.receivedBytes,0);
 const first=ctx.sendFinalUploadChunk(packet(m,b));assert.equal(first.receivedBytes,1024*1024);assert.equal(first.complete,false);assert.equal(sheets.SURAT_FINAL.rows[1][1],'');
 const last=ctx.sendFinalUploadChunk(packet(m,b,first.receivedBytes));assert.equal(last.receivedBytes,b.length);assert.equal(last.complete,false);
 const done=ctx.finishFinalUpload({uploadToken:m.uploadToken});assert.equal(done.complete,true);assert.equal(sheets.SURAT_FINAL.rows[1][1],'drive-1');
 assert(!JSON.stringify([start,first,last,done]).includes('googleapis'));assert(!JSON.stringify(done).includes('test-oauth'));
});
test('lost acknowledgement resumes instead of appending duplicate bytes',()=>{
 const b=file('lost'),m=meta('one',b);ctx.startFinalUpload(m);lostAck=true;
 assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).retryable,true);assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).receivedBytes,1024*1024);
 assert.equal(ctx.sendFinalUploadChunk(packet(m,b,1024*1024)).receivedBytes,b.length);assert.equal(ctx.finishFinalUpload({uploadToken:m.uploadToken}).complete,true);assert.equal(drive['drive-1'].bytes.length,b.length);
});
test('lost last response and expired session recover by pre-generated file ID',()=>{
 const b=file('last',1000),m=meta('one',b);ctx.startFinalUpload(m);lostAck=true;assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).retryable,true);delete sessions['drive-1'];
 assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).receivedBytes,b.length);assert.equal(ctx.finishFinalUpload({uploadToken:m.uploadToken}).complete,true);
 assert.equal(Object.keys(drive).length,1);
});
test('begin retries and finalization retries are idempotent',()=>{
 const b=file('retry',1000),m=meta('one',b);ctx.startFinalUpload(m);ctx.startFinalUpload(m);assert.equal(nextId,1);ctx.sendFinalUploadChunk(packet(m,b));
 ctx.finishFinalUpload({uploadToken:m.uploadToken});ctx.finishFinalUpload({uploadToken:m.uploadToken});assert.equal(sheets.SURAT_FINAL.rows[1][9],1);
});
test('network interruption before receiving a packet retains the previous offset',()=>{
 const b=file('offline'),m=meta('one',b);ctx.startFinalUpload(m);failFetch=true;assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).retryable,true);
 const r=ctx.sendFinalUploadChunk(packet(m,b));assert.equal(r.receivedBytes,1024*1024);assert.equal(sessions['drive-1'].bytes.length,1024*1024);
});
test('out-of-order or duplicate packets never create holes or duplicate content',()=>{
 const b=file('order'),m=meta('one',b);ctx.startFinalUpload(m);assert.equal(ctx.sendFinalUploadChunk(packet(m,b,1024*1024)).receivedBytes,0);
 ctx.sendFinalUploadChunk(packet(m,b));assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).receivedBytes,1024*1024);assert.equal(sessions['drive-1'].bytes.length,1024*1024);
});
test('same-number parallel session and same-PDF cross-number session are rejected',()=>{
 const b=file('dedup'),m=meta('one',b);ctx.startFinalUpload(m);
 assert.throws(()=>ctx.startFinalUpload(meta('one',file('other'),'b'.repeat(32))),/sedang diunggah/);
 assert.throws(()=>ctx.startFinalUpload(meta('two',b,'c'.repeat(32))),/PDF yang sama/);
});
test('per-session lease rejects simultaneous packets while other sessions can proceed',()=>{
 const b=file('lease'),m=meta('one',b);ctx.startFinalUpload(m);hook=()=>{assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).retryable,true);};
 assert.equal(ctx.sendFinalUploadChunk(packet(m,b)).receivedBytes,1024*1024);
});
test('ten transfers interleave outside the global lock and keep file associations correct',()=>{
 const jobs=Array.from({length:10},(_,i)=>{const id='parallel-'+i;sheets.PERMINTAAN.appendRow(request(id,'Uji '+i));const bytes=file('parallel '+i,1000);return {bytes,m:meta(id,bytes,(i+1).toString(16).padStart(32,'0'))};});
 jobs.forEach(j=>assert.equal(ctx.startFinalUpload(j.m).success,true));
 function transfer(i){if(i+1<jobs.length)hook=()=>transfer(i+1);assert.equal(ctx.sendFinalUploadChunk(packet(jobs[i].m,jobs[i].bytes)).success,true);}
 transfer(0);assert.equal(maxInFlight,10);jobs.forEach(j=>assert.equal(ctx.finishFinalUpload({uploadToken:j.m.uploadToken}).complete,true));
 jobs.forEach((j,i)=>assert.equal(sheets.SURAT_FINAL.rows.find(r=>r[0]===j.m.requestId)[1],'drive-'+(i+1)));
});
test('cancellation during transfer blocks commit and trashes only the new file',()=>{
 const b=file('cancel',1000),m=meta('one',b);ctx.startFinalUpload(m);ctx.sendFinalUploadChunk(packet(m,b));sheets.PERMINTAAN.rows[1][10]='DIBATALKAN';
 const r=ctx.finishFinalUpload({uploadToken:m.uploadToken});assert.equal(r.restart,true);assert.equal(sheets.SURAT_FINAL.rows[1][1],'');assert.equal(drive['drive-1'].trashed,true);
});
test('integrity mismatch leaves the number incomplete and cleans up the failed file',()=>{
 const b=file('hash',1000),m=meta('one',b);ctx.startFinalUpload(m);ctx.sendFinalUploadChunk(packet(m,b));failHash=true;
 assert.equal(ctx.finishFinalUpload({uploadToken:m.uploadToken}).restart,true);assert.equal(sheets.SURAT_FINAL.rows[1][1],'');assert.equal(drive['drive-1'].trashed,true);
});
test('public replacement stays forbidden; failed admin replacement preserves previous file',()=>{
 const b=file('old',1000),m=meta('one',b);assert.equal(sendAll(m,b).complete,true);
 assert.throws(()=>ctx.startFinalUpload(meta('one',file('new',1000),'b'.repeat(32))),/Penggantian hanya/);
 const newer=file('newer',1000),admin=meta('one',newer,'c'.repeat(32),'admin-test');ctx.startFinalUpload(admin);ctx.sendFinalUploadChunk(packet(admin,newer));failHash=true;ctx.finishFinalUpload({uploadToken:admin.uploadToken,adminToken:'admin-test'});
 assert.equal(sheets.SURAT_FINAL.rows[1][1],'drive-1');assert.equal(drive['drive-1'].trashed,false);assert.equal(drive['drive-2'].trashed,true);
});
test('server rejects forged sessions, oversized packets and declared files over 20 MiB',()=>{
 assert.throws(()=>ctx.startFinalUpload({...meta('one',file('large',1000)),size:20*1024*1024+1}),/maksimal/);
 assert.throws(()=>ctx.sendFinalUploadChunk({uploadToken:'bad',offset:0,data:'AAAA'}),/Sesi/);
 assert.throws(()=>ctx.sendFinalUploadChunk({uploadToken:'a'.repeat(32),offset:0,data:'A'.repeat(2*1024*1024)}),/Paket/);
});
console.log(passed+' resumable server scenarios passed.');
