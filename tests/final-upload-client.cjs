const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../FinalUploadClient.html'),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function harness(){
 const jobs={},calls=[],progress=[];let failOffset=-1,lostOnce=false,hook=null;
 function runner(ok,fail){return new Proxy({withSuccessHandler(fn){return runner(fn,fail);},withFailureHandler(fn){return runner(ok,fn);}},{get(target,name){if(name in target)return target[name];return payload=>{
   calls.push({name,payload});setImmediate(()=>{try{
     if(hook)hook(name,payload);
     if(name==='startFinalUpload')jobs[payload.uploadToken]||=( {size:payload.size,offset:0,phase:'uploading'} );
     const job=jobs[payload.uploadToken];assert(job);
     if(name==='cancelFinalUpload'){ok({success:true,cancelled:true,receivedBytes:job.offset,totalBytes:job.size});return;}
     if(name==='sendFinalUploadChunk'){
       if(payload.offset>=failOffset&&failOffset>=0){fail({message:'network offline'});return;}
       if(payload.offset===job.offset)job.offset+=Buffer.from(payload.data,'base64').length;
       if(lostOnce){lostOnce=false;fail({message:'acknowledgement lost'});return;}
     }
     if(name==='finishFinalUpload'){assert.equal(job.offset,job.size);job.phase='complete';}
     ok({success:true,complete:job.phase==='complete',receivedBytes:job.offset,totalBytes:job.size,chunkBytes:1024*1024});
   }catch(e){fail(e);}});
 };}});}
 const ctx=vm.createContext({crypto:crypto.webcrypto,Uint8Array,Array,Date,Number,Promise,String,Math,navigator:{onLine:true},btoa:s=>Buffer.from(s,'binary').toString('base64'),google:{script:{run:runner()}},setTimeout:fn=>setImmediate(fn),setInterval:()=>1,clearInterval(){}});
 vm.runInContext(source,ctx);
 function upload(file,id='one'){return new Promise((resolve,reject)=>ctx.FinalUploadClient.upload({file,requestId:id,onProgress:p=>progress.push({...p}),onSuccess:resolve,onFailure:(msg,restart)=>{const e=new Error(msg);e.restart=restart;reject(e);}}));}
 return {upload,calls,jobs,progress,setFailOffset:v=>failOffset=v,setLost:()=>lostOnce=true,setHook:fn=>hook=fn};
}
function pdf(label='test',size=2*1024*1024+17){const bytes=Buffer.alloc(size,32);bytes.write('%PDF-1.4\n'+label);return new File([bytes],'test.pdf',{type:'application/pdf'});}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
 await test('progress uses acknowledged bytes and shows finalization separately from success',async()=>{
   const h=harness();let sawFirst=false,sawFinish=false;h.setHook((name,p)=>{if(name==='sendFinalUploadChunk'&&!sawFirst){sawFirst=true;assert.equal(h.progress.at(-1).percent,0);}if(name==='finishFinalUpload'){sawFinish=true;assert.equal(h.progress.at(-1).percent,100);assert.match(h.progress.at(-1).phase,/memeriksa/);}});
   await h.upload(pdf());assert(sawFirst&&sawFinish);assert(h.progress.some(p=>p.percent===49));assert.equal(h.progress.at(-1).phase,'Final berhasil tersimpan.');
 });
 await test('lost acknowledgement retries the same packet and resumes at confirmed offset',async()=>{
   const h=harness();h.setLost();await h.upload(pdf('lost'));const packets=h.calls.filter(c=>c.name==='sendFinalUploadChunk');assert.deepEqual(packets.slice(0,2).map(c=>c.payload.offset),[0,0]);assert.equal(packets[2].payload.offset,1024*1024);
 });
 await test('manual continue preserves the session and does not resend acknowledged first packet',async()=>{
   const h=harness(),file=pdf('pause');h.setFailOffset(1024*1024);await assert.rejects(h.upload(file),/offline/);const boundary=h.calls.length;h.setFailOffset(-1);await h.upload(file);
   const starts=h.calls.filter(c=>c.name==='startFinalUpload');assert.equal(starts[0].payload.uploadToken,starts[1].payload.uploadToken);assert.equal(h.calls.slice(boundary).find(c=>c.name==='sendFinalUploadChunk').payload.offset,1024*1024);
 });
 await test('a different selected file cancels its previous session before starting a new one',async()=>{
   const h=harness();h.setFailOffset(1024*1024);await assert.rejects(h.upload(pdf('old')),/offline/);h.setFailOffset(-1);await h.upload(pdf('new',1000));const names=h.calls.map(c=>c.name),cancel=names.indexOf('cancelFinalUpload');assert(cancel>0);assert.equal(names[cancel+1],'startFinalUpload');
   const starts=h.calls.filter(c=>c.name==='startFinalUpload');assert.notEqual(starts[0].payload.uploadToken,starts[1].payload.uploadToken);
 });
 await test('invalid PDFs and oversized files never start a remote upload',async()=>{
   const h=harness();await assert.rejects(h.upload(new File(['hello'],'fake.pdf')),/PDF/);await assert.rejects(h.upload(new File([Buffer.alloc(20*1024*1024+1)],'huge.pdf')),/maksimal/);assert.equal(h.calls.length,0);
 });
 console.log(passed+' resumable client scenarios passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
