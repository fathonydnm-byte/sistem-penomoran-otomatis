const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

// Exercise the actual client event handlers without a browser dependency.
class Element {
  constructor(tag = 'select') { this.tag = tag; this.value = ''; this.hidden = false; this.disabled = false; this.children = []; this.events = {}; this.attributes = {}; this._text = ''; }
  set textContent(value) { this._text = value; this.children = []; if (this.tag === 'select') this.value = ''; }
  get textContent() { return this._text; }
  appendChild(child) { this.children.push(child); }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
const elements = {};
const document = {
  getElementById(id) { return elements[id] || (elements[id] = new Element()); },
  createElement(tag) { return new Element(tag); },
  execCommand() { return false; }
};
const context = vm.createContext({document, navigator: {}, console});
const partial = fs.readFileSync(path.join(root, 'LetterCodes.html'), 'utf8');
for (const script of partial.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], context);
const generator = context.LetterCodeGenerator;
const field = suffix => document.getElementById('letterCode' + suffix);
const master = context.LETTER_CODE_MASTER;
function change(suffix, value) { const el = field(suffix); el.value = value; el.events.change(); }
function configure(overrides = {}) { generator.configure({success:true,number:469,documentType:'Surat Dinas',letterDate:'2026-04-09',...overrides}); }
function ready() { configure(); change('Urgency','B'); change('Officer','BU'); }
function select(primary, secondary, tertiary) { change('Primary',primary); change('Secondary',secondary); if (tertiary !== undefined) change('Tertiary',tertiary); }
function code() { return field('Result').value; }
let passed = 0;
async function test(name, fn) { generator.reset(); await fn(); console.log('PASS ' + name); passed++; }

(async () => {
  await test('only successful Surat Dinas and Nota Dinas expose the optional generator', () => {
    assert.equal(field('Offer').hidden,true);
    configure(); assert.equal(field('Offer').hidden,false); assert.equal(field('Fields').hidden,true);
    configure({documentType:'Nota Dinas'}); assert.equal(field('Offer').hidden,false);
    for (const documentType of ['SK/SE','SK','Other','']) { configure({documentType}); assert.equal(field('Offer').hidden,true); }
    configure({success:false}); assert.equal(field('Offer').hidden,true);
  });
  await test('number and year come from issued record; month defaults to the letter date', () => {
    configure({number:771,letterDate:'2024-07-31'});
    assert.equal(field('Number').value,'771');assert.equal(field('Year').value,'2024');assert.equal(field('Month').value,'07');
    assert.equal(field('Copy').disabled,true);
  });
  await test('incomplete or malformed issued metadata never generates a code', () => {
    for (const overrides of [{number:''},{number:'12/34'},{number:0},{number:-1},{letterDate:''},{letterDate:'2026-02-30'},{letterDate:'2026-13-01'}]) {
      configure(overrides);assert.equal(field('Offer').hidden,true);assert.equal(code(),'');
    }
  });
  await test('months are ordered January through December', () => {
    assert.equal(field('Month').children.length,12);assert.equal(field('Month').children[0].value,'01');assert.equal(field('Month').children[11].value,'12');
  });
  await test('direct signer and three-level classification produce the Excel code', () => {
    ready();select('PP','00','9');assert.equal(code(),'B-469/Un.07/01/BU/PP.00.9/04/2026');assert.equal(field('Copy').disabled,false);
  });
  await test('a.n. Rektor puts R before the actual signer and excludes Rektor as delegate', () => {
    ready();change('Mode','onBehalf');select('PP','00','9');assert.equal(code(),'B-469/Un.07/01/R/BU/PP.00.9/04/2026');
    assert.equal(field('Officer').children.length,27);assert(!field('Officer').children.some(x=>x.value==='R'));
    change('Officer','R');assert.equal(code(),'');
    change('Mode','direct');assert(field('Officer').children.some(x=>x.value==='R'));
  });
  await test('two-level classification has no trailing dot', () => {
    ready();select('KU','05');assert.equal(code(),'B-469/Un.07/01/BU/KU.05/04/2026');assert.equal(field('TertiaryField').hidden,true);
  });
  await test('TL.03 uses the code confirmed by the owner', () => {
    ready();select('TL','03');assert.equal(code(),'B-469/Un.07/01/BU/TL.03/04/2026');
  });
  await test('non-TP-5000 complaint follows Excel PS.03.4, not HTML PS.04', () => {
    ready();select('PS','03','4');assert.equal(code(),'B-469/Un.07/01/BU/PS.03.4/04/2026');
    assert(!master.classifications.find(p=>p.code==='PS').children.some(s=>s.code==='04'));
  });
  await test('HTML-only tertiary entries are absent from the Excel master', () => {
    assert.equal(master.classifications.find(p=>p.code==='KU').children.find(s=>s.code==='03').children.length,1);
    assert.equal(master.classifications.find(p=>p.code==='KP').children.find(s=>s.code==='04').children.length,2);
  });
  await test('primary changes reset secondary and tertiary; stale children cannot produce output', () => {
    ready();select('PP','00','9');change('Primary','KU');
    assert.equal(field('Secondary').value,'');assert.equal(field('Tertiary').value,'');assert.equal(code(),'');assert.equal(field('Copy').disabled,true);
    change('Secondary','00');assert.equal(code(),'');change('Tertiary','9');assert.equal(code(),'');
  });
  await test('secondary changes clear the previous tertiary', () => {
    ready();select('PP','00','9');change('Secondary','01');assert.equal(field('Tertiary').value,'');assert.equal(code(),'');
    change('Tertiary','2');assert.equal(code(),'B-469/Un.07/01/BU/PP.01.2/04/2026');
  });
  await test('Haji Bimbingan never inherits Pembinaan Agama tertiary options', () => {
    ready();select('BA','01','1');assert(code().includes('/BA.01.1/'));
    select('HJ','01');assert.equal(field('TertiaryField').hidden,true);assert(code().includes('/HJ.01/'));
  });
  await test('month changes retain issued year and number even for an old-year record', () => {
    ready();configure({number:771,letterDate:'2024-07-31'});change('Urgency','SR');change('Officer','R1');select('TL','03');change('Month','12');
    assert.equal(code(),'SR-771/Un.07/01/R1/TL.03/12/2024');
    field('Number').value='999';field('Year').value='2035';change('Month','01');assert.equal(code(),'SR-771/Un.07/01/R1/TL.03/01/2024');
  });
  await test('a new request clears old selections and generated code', () => {
    ready();select('PP','00','9');configure({number:900,documentType:'Nota Dinas',letterDate:'2026-10-29'});
    assert.equal(code(),'');assert.equal(field('Number').value,'900');assert.equal(field('Primary').value,'');assert.equal(field('Mode').value,'direct');assert.equal(field('Fields').hidden,true);
    generator.reset();assert.equal(field('Offer').hidden,true);assert.equal(field('Result').value,'');
  });
  await test('clipboard rejection with failed fallback never reports success', async () => {
    ready();select('KU','05');context.navigator.clipboard={writeText(){return Promise.reject(Error('denied'));}};
    field('Copy').events.click();await new Promise(resolve=>setImmediate(resolve));
    assert.match(field('Feedback').textContent,/manual/);assert(!field('Feedback').textContent.includes('berhasil'));assert(field('Result').selected);
  });
  await test('clipboard success is reported only after the promise resolves', async () => {
    ready();select('KU','05');let resolveCopy, copied;
    context.navigator.clipboard={writeText(value){copied=value;return new Promise(resolve=>{resolveCopy=resolve;});}};
    field('Copy').events.click();assert.equal(field('Feedback').textContent,'');assert.equal(copied,code());
    resolveCopy();await new Promise(resolve=>setImmediate(resolve));assert.match(field('Feedback').textContent,/berhasil/);
  });
  await test('a pending clipboard response cannot update a later request', async () => {
    ready();select('KU','05');let resolveCopy;
    context.navigator.clipboard={writeText(){return new Promise(resolve=>{resolveCopy=resolve;});}};
    field('Copy').events.click();generator.reset();resolveCopy();await new Promise(resolve=>setImmediate(resolve));assert.equal(field('Feedback').textContent,'');
  });
  await test('all Excel classification paths have unique parent-scoped codes', () => {
    assert.equal(master.officers.length,27);assert.equal(master.classifications.length,12);
    let secondaryCount=0,tertiaryCount=0;
    for (const primary of master.classifications) {
      assert.equal(new Set(primary.children.map(s=>s.code)).size,primary.children.length);
      for (const secondary of primary.children) { secondaryCount++;tertiaryCount+=secondary.children.length;assert.equal(new Set(secondary.children.map(t=>t.code)).size,secondary.children.length); }
    }
    assert.equal(secondaryCount,65);assert.equal(tertiaryCount,96);
  });
  console.log(passed+' letter-code scenarios passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
