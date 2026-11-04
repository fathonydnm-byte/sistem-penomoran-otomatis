const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.equal(JSON.parse(read('appsscript.json')).webapp.access,'MYSELF');
assert.equal(JSON.parse(read('.clasp.json')).scriptId,'');
const code=read('Code.js');
for(const id of ['1C-u9r4440ZDprkcZMSnjbjki-FoVEF99DmwJmUZpjXs','1KF7Ak9xReV8MvLmtzMd855tihVi0XBlB'])assert(!code.includes(id),'Production resource ID must be absent');
const workflow=read('.github/workflows/final-staging.yml');assert(workflow.includes('branches: [feature/pelengkapan-surat-final]'));assert(workflow.includes('working-directory: .staging'));assert(!workflow.includes('--deploymentId'));assert(!workflow.includes('git push'));
const productionWorkflow=read('.github/workflows/clasp-push.yml');assert(!productionWorkflow.includes('feature/pelengkapan-surat-final'));
const context=vm.createContext({APP:{},ScriptApp:{getScriptId(){return '1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_';}}});
assert.throws(()=>vm.runInContext(read('Staging.js'),context),/STOP/);
// Reusing a spreadsheet in one execution must not re-read staging properties for each sheet lookup.
let binds=0,opens=0;
const cachedBook={},spreadsheetContext=vm.createContext({APP:{SPREADSHEET_ID:''},SPREADSHEET_INSTANCE_:null,
  bindFinalStaging_(){binds++;spreadsheetContext.APP.SPREADSHEET_ID='staging-only';},
  SpreadsheetApp:{openById(id){assert.equal(id,'staging-only');opens++;return cachedBook;}}});
vm.runInContext(code.match(/function getSpreadsheet_\(\) \{[\s\S]*?\n\}/)[0],spreadsheetContext);
assert.equal(spreadsheetContext.getSpreadsheet_(),cachedBook);assert.equal(spreadsheetContext.getSpreadsheet_(),cachedBook);
assert.equal(binds,1);assert.equal(opens,1);
spreadsheetContext.SPREADSHEET_INSTANCE_=null;spreadsheetContext.getSpreadsheet_();assert.equal(binds,2);assert.equal(opens,2);
for(const file of ['Code.js','Bulk.js','Admin.js','Reservations.js','FinalLetters.js','Staging.js'])new vm.Script(read(file));
for(const file of ['Index.html','FinalLettersUI.html','LetterCodes.html'])for(const s of read(file).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
console.log('PASS staging isolation, production deny guard, private manifest, and all client/server scripts parse.');
