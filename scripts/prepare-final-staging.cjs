const fs=require('node:fs');const path=require('node:path');
const target=JSON.parse(fs.readFileSync('.staging/.clasp.json','utf8'));
const production='1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_';
if(!target.scriptId||target.scriptId===production)throw Error('STOP: target harus project UJI terpisah');
const manifest=JSON.parse(fs.readFileSync('appsscript.json','utf8'));
if(manifest.webapp.access!=='MYSELF')throw Error('STOP: staging hanya untuk akun deployer');
for(const f of fs.readdirSync('.staging'))if(/\.(js|gs|html)$/.test(f)||f==='appsscript.json')fs.unlinkSync(path.join('.staging',f));
for(const f of fs.readdirSync('.'))if(/\.(js|html)$/.test(f)||f==='appsscript.json')fs.copyFileSync(f,path.join('.staging',f));
// Never inherit an external rootDir or ignore rules from an earlier clasp create.
fs.writeFileSync('.staging/.clasp.json',JSON.stringify({scriptId:target.scriptId,rootDir:''},null,2));
fs.writeFileSync('.staging/.claspignore','**/.git/**\n**/*.txt\n');
console.log('Project UJI:',target.scriptId);
