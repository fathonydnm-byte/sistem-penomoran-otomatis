const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let rows=[],locked=false,privateBook=true,flushes=0;
const legacy=new Map(),sheets={};
const sheet={getSheetId:()=>42,getLastRow:()=>rows.length,getRange(row,col,h=1,w=1){return {
 getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),
 setValues(values){if(row>rows.length)assert(locked,'new row must hold script lock');values.forEach((r,i)=>{rows[row-1+i]||=[];r.forEach((v,j)=>rows[row-1+i][col-1+j]=v);});},
 createTextFinder(text){return {matchEntireCell(){return this;},findAll(){return rows.flatMap((r,i)=>i>=row-1&&String(r[col-1])===text?[{getRow:()=>i+1}]:[]);}}}
}}};
const book={getId:()=> 'private-book',getSheetById:id=>id===42?sheets.GENERATOR_JOBS:null,getSheetByName:n=>{assert(locked,'sheet metadata must be first read under lock');return sheets[n];},insertSheet(n){assert(locked);sheets[n]=sheet;return sheet;}};
const ctx=vm.createContext({console,Date,SpreadsheetApp:{openById:id=>{assert.equal(id,'private-book');return book;},flush(){flushes++;}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>legacy.get(k),setProperty:(k,v)=>legacy.set(k,v)})},
 finalLedgerBook_:()=>{assert(locked,'workbook must first open under lock');if(!privateBook)throw Error('must be private');return book;},
 letterDraftLock_:fn=>{assert(!locked);locked=true;try{return fn();}finally{locked=false;}}
});
vm.runInContext(fs.readFileSync('LetterDraftJobs.js','utf8'),ctx);
const store=t=>ctx.letterDraftJobStore_(t),set=(s,j)=>ctx.letterDraftLock_(()=>s.set(j));
privateBook=false;assert.throws(()=>store('a'),/private/);privateBook=true;
legacy.set('LETTER_DRAFT_old',JSON.stringify({done:true,docId:'old-doc'}));
const old=store('old');assert.equal(old.get().docId,'old-doc');set(old,{done:true,docId:'old-doc',number:123});
assert.equal(store('old').get().number,123);assert.equal(JSON.parse(legacy.get('LETTER_DRAFT_old')).number,undefined);
const stores=Array.from({length:10},(_,i)=>store('user-'+i));
stores.forEach((s,i)=>set(s,{docId:'doc-'+i,until:Date.now()+420000}));
rows=[rows[0],...rows.slice(1).reverse()];
stores.forEach((s,i)=>s.set({...s.get(),number:100+i}));
stores.forEach((s,i)=>assert.deepEqual(JSON.parse(JSON.stringify(s.get())),{docId:'doc-'+i,until:JSON.parse(rows.find(r=>r[0]==='user-'+i)[1]).until,number:100+i}));
const large=store('large');set(large,{request:{to:'Pejabat lengkap '.repeat(1000)}});assert.equal(large.get().request.to.length,16000);
assert.throws(()=>set(store('too-large'),{body:'x'.repeat(46000)}),/terlalu panjang/);
rows.push(rows.find(r=>r[0]==='user-0').slice());assert.throws(()=>store('user-0').get(),/ganda/);
assert(flushes>10);
console.log('PASS private durable jobs: 10 independent leases, row sorting, >9KB record, legacy migration, duplicate fail-closed, durable flush.');
