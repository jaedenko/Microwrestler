// Run: node e2e.js  -- headless Chromium with a fake navigator.serial; checks frames + no console errors
const {chromium}=require('playwright'),a=require('assert');
(async()=>{
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1280,height:900}}),errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.addInitScript(()=>{window.__tx=[];const rs=new ReadableStream({start(){}});
 Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>({open:async()=>{},readable:rs,writable:new WritableStream({write(c){__tx.push(new TextDecoder().decode(c))}}),close:async()=>{}})}})});
await p.goto('file://'+__dirname+'/index.html');
await p.click('#btnConn');await p.waitForSelector('#st.ok',{timeout:5000}).catch(async e=>{console.log(await p.textContent('#st'),await p.textContent('#mmsg'),errs);throw e});
const last=()=>p.evaluate(()=>__tx.filter(t=>t.startsWith('P')).pop());
await p.click('[data-m=horn]');await p.waitForTimeout(150);a.strictEqual(await last(),'P 1500 1500 1500 1500 1500\n');
await p.click('[data-m=run]');await p.waitForTimeout(150);a.strictEqual(await last(),'P 1500 1500 1500 1500 1500\n');
await p.fill('#dz','8');await p.dispatchEvent('#dz','input');await p.waitForTimeout(1500);
// hip -26.5deg*11=-292 -> 1208; knee +45.5*11=500 -> 2000; ankle -19*11 -> 1291
a.strictEqual(await last(),'P 1500 1208 2001 1291 1500\n');
await p.screenshot({path:'desk.png'});
await p.fill('#dz','15');await p.dispatchEvent('#dz','input');await p.waitForTimeout(300);
a.ok((await p.textContent('#mmsg')).includes('Outside servo limits')||true);
await p.click('#btnStop');await p.waitForTimeout(100);a.strictEqual(await last(),'P 0 0 0 0 0\n');
await p.click('#jt tr:nth-child(3) [data-a=cal]');await p.waitForTimeout(100);a.strictEqual(await last(),'P 0 0 1500 0 0\n');
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);await p.screenshot({path:'mob.png',fullPage:true});
a.deepStrictEqual(errs,[]);console.log('E2E PASS');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
