const fs=require('node:fs'),path=require('node:path');
const target='1voCWP8UrNRyXNgCZPUaFkgmbZEKOzOZ1TodxLLuMb_kWT9BtxB5HiFlz';
const dir='.chunk-staging';fs.mkdirSync(dir,{recursive:true});
for(const file of fs.readdirSync('.'))if(/\.(js|html)$/.test(file))fs.copyFileSync(file,path.join(dir,file));
let code=fs.readFileSync(path.join(dir,'Code.js'),'utf8');
for(const key of ['SPREADSHEET_ID','ROOT_FOLDER_ID','WEB_APP_URL'])code=code.replace(new RegExp("  "+key+": '[^']*'"),"  "+key+": ''");
code=code.replace('function doGet() {','function doGet() {\n  bindChunkStaging_();');
code=code.replace('ensureFinalProduction_();','ensureChunkStagingLedger_();');
code=code.replace('if (!SPREADSHEET_INSTANCE_) {','if (!SPREADSHEET_INSTANCE_) {\n    bindChunkStaging_();');
code=code.replace("HtmlService.createHtmlOutputFromFile('FinalLettersUI').getContent();","HtmlService.createHtmlOutputFromFile('FinalLettersUI').getContent()+HtmlService.createHtmlOutputFromFile('ChunkLoadTest').getContent()+HtmlService.createHtmlOutputFromFile('GeneratorLoadTest').getContent();");
fs.writeFileSync(path.join(dir,'Code.js'),code);
const storage=fs.readFileSync('FinalStorage.js','utf8').replace(/FINAL_PROD_/g,'CHUNK_UAT_');
fs.writeFileSync(path.join(dir,'FinalStorage.js'),storage);
let server=fs.readFileSync(path.join(dir,'FinalUpload.js'),'utf8');
for(const [name,internal]of [['startFinalUpload','chunkTestStart_'],['sendFinalUploadChunk','chunkTestSend_'],['finishFinalUpload','chunkTestFinish_'],['cancelFinalUpload','chunkTestCancel_']])server=server.replace('function '+name+'(','function '+internal+'(');
fs.writeFileSync(path.join(dir,'FinalUpload.js'),server);
fs.copyFileSync('scripts/fixtures/ChunkStaging.txt',path.join(dir,'ChunkStaging.js'));
fs.copyFileSync('scripts/fixtures/ChunkLoadTest.txt',path.join(dir,'ChunkLoadTest.html'));
const manifest=JSON.parse(fs.readFileSync('appsscript.json','utf8'));manifest.webapp.access='MYSELF';
fs.writeFileSync(path.join(dir,'appsscript.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId:target,rootDir:''}));
if(code.includes('1C-u9r4440ZDprkcZMSnjbjki-FoVEF99DmwJmUZpjXs')||code.includes('AKfycbz4i88ZxnpnlvDV2bgBH3eebT2m7tAHMRo_vCJOurG1BF6HTzT28dXXss3A97gMp-DH'))throw Error('STOP: production target present in staging source');
console.log('Staging-only project:',target);

fs.copyFileSync('scripts/fixtures/GeneratorLoadServer.txt',path.join(dir,'GeneratorLoadServer.js'));
fs.copyFileSync('scripts/fixtures/GeneratorLoadTest.txt',path.join(dir,'GeneratorLoadTest.html'));
if(fs.existsSync('LetterDraftJobs.js')) {
  const jobs=fs.readFileSync('LetterDraftJobs.js','utf8').replace(/GENERATOR_JOBS/g,'GENERATOR_JOBS_UAT3');
  fs.writeFileSync(path.join(dir,'LetterDraftJobs.js'),jobs);
}
