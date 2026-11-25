// Run: python3 -m http.server 8123 & node e2e.js  -- headless Chromium with a fake navigator.serial; checks frames, tabs, wizard, no console errors
const {chromium}=require('playwright'),a=require('assert');
const P=(...v)=>'P '+v.concat(Array(16-v.length).fill(0)).join(' ')+'\n';   // a frame: value per channel, rest released
(async()=>{
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}),p=await b.newPage({viewport:{width:1280,height:900}}),errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.addInitScript(()=>{window.__tx=[];const rs=new ReadableStream({start(c){window.__rx=t=>c.enqueue(new TextEncoder().encode(t))}});
 Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>({open:async()=>{setTimeout(()=>__rx('bridge ready\r\n'),300)},readable:rs,writable:new WritableStream({write(c){__tx.push(new TextDecoder().decode(c))}}),close:async()=>{}})}})});
await p.goto('http://localhost:8123/index.html');await p.waitForSelector('body[data-gl=ok]',{timeout:20000});
await p.click('#btnConn');await p.waitForSelector('#st.ok',{timeout:5000});a.strictEqual(await p.textContent('#st'),'Nano ready');
const last=()=>p.evaluate(()=>__tx.filter(t=>t.startsWith('P')).pop());
const tick=ms=>p.waitForTimeout(ms);
const until=async(f,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){if(await last()===f)return;await tick(100)}a.strictEqual(await last(),f)};   // slew is slow under a software GL renderer
// leg: ch0 hip pitch, ch1 knee, ch2 ankle pitch, ch3 ankle roll, ch4 hip yaw. Right leg not built.
await p.click('[data-m=horn]');await tick(150);a.strictEqual(await last(),P(1500,1500,1500,1500,1500));
await p.click('[data-m=run]');await tick(150);a.strictEqual(await last(),P(1500,1500,1500,1500,1500));
await p.fill('#dz','8');await p.dispatchEvent('#dz','input');
await until(P(1208,2001,1291,1500,1500));
await p.click('[data-kn=back]');await until(P(1822,946,1732,1500,1500));                                   // knee-backward squat: knee servo goes BELOW 90 deg (1500 us)
await p.click('[data-kn=fwd]');await until(P(1208,2001,1291,1500,1500));                       // hip -26.5, knee +45.5, ankle -19 deg x 11 us
await p.screenshot({path:'sq3d.png'});
await p.click('#btnStop');await tick(100);a.strictEqual(await last(),P());
await p.click('#jt [data-j=knee] [data-a=cal]');await tick(100);a.strictEqual(await last(),P(0,1500));
await p.click('#jt [data-j=knee] [data-a=cal]');
// right leg is independent and not installed: Calibrate is disabled until Installed is ticked
await p.click('[data-t=R]');a.ok(await p.locator('#jt [data-j=r_knee] [data-a=cal]').isDisabled());
await p.check('#jt [data-j=r_knee] [data-k=on]');await p.click('#jt [data-j=r_knee] [data-a=cal]');await tick(100);a.strictEqual(await last(),P(0,0,0,0,0,0,1500));
await p.fill('#jt [data-j=r_knee] [data-k=hi]','1700');await p.dispatchEvent('#jt [data-j=r_knee] [data-k=hi]','change');
await p.click('#jt [data-j=r_knee] [data-a=cal]');await p.fill('#dz','10');await p.dispatchEvent('#dz','input');
const m=await p.textContent('#mmsg');a.ok(/right knee/.test(m)&&!/left/.test(m),m);
await p.click('#jt [data-j=r_knee] [data-a=cal]');await p.click('#jt [data-j=r_knee] [data-a=rj]');
a.strictEqual(await p.isChecked('#jt [data-j=r_knee] [data-k=on]'),false);       // reset joint -> back to not installed
await p.click('[data-t=L]');
// ---- guided calibration of the left leg (order top-down: hip yaw, hip pitch, knee, ankle pitch, ankle roll)
await p.click('[data-m=rel]');await p.click('#bGuide');await p.waitForSelector('#wiz [data-act=start]');
await p.screenshot({path:'wiz-intro.png'});
await p.click('[data-act=start]');await tick(80);a.strictEqual(await last(),P(0,0,0,0,1500));            // yaw first: only that servo
for(const s of ['next','next','skip','skip','next'])await p.click('[data-act='+s+']');
await tick(80);a.strictEqual(await last(),P(1500,0,0,0,1500));                                          // hip pitch centre step; yaw holds its centre
const n=(v)=>p.click('[data-act=n][data-arg="'+v+'"]');
await n(10);await n(10);await until(P(1520,0,0,0,1500));
await p.screenshot({path:'wiz-centre.png'});
await p.click('[data-act=next]');await until(P(1685,0,0,0,1500));                                       // direction check: servo goes to +15 deg
await p.screenshot({path:'wiz-dir.png'});
await p.click('[data-act=next]');await tick(900);                                                         // "yes": negative end
for(let i=0;i<5;i++)await n(-10);await tick(500);await p.screenshot({path:'wiz-neg.png'});
await p.click('[data-act=next]');await tick(900);                                                         // touching at 1470 -> backed off to 1503
for(let i=0;i<5;i++)await n(10);await tick(500);await p.click('[data-act=next]');                         // touching at 1570 -> 1537
await tick(100);await p.click('[data-act=next]');                                                         // range test ok
const get=id=>p.evaluate(i=>JSON.parse(localStorage.getItem('wb3.joints')).find(j=>j.id===i),id);
let hip=await get('hip');a.deepStrictEqual([hip.trim,hip.lo,hip.hi,hip.sign],[20,1503,1537,1]);
// knee bends BOTH ways: 50 us either side of centre
await p.click('[data-act=next]');await p.click('[data-act=next]');
for(let i=0;i<5;i++)await n(-10);await tick(300);await p.click('[data-act=next]');
for(let i=0;i<5;i++)await n(10);await tick(300);await p.click('[data-act=next]');await p.click('[data-act=next]');
const knee=await get('knee');a.deepStrictEqual([knee.lo,knee.hi],[1483,1517]);
// ankle: wrong direction -> flip; roll: just click through
for(const s of ['next','flip','next','skip','skip','next'])await p.click('[data-act='+s+']');
a.strictEqual((await get('ankle')).sign,-1);
for(const s of ['next','next','skip','skip','next'])await p.click('[data-act='+s+']');
await p.waitForSelector('#wiz [data-act=finish]');await p.screenshot({path:'wiz-done.png'});
await p.click('[data-act=finish]');await until(P(1520,1500,1500,1500,1500));                            // Run holds the new centres
// ---- connection diagnostics: no reply from the Nano -> visible warning
await p.screenshot({path:'desk.png'});
await p.setViewportSize({width:390,height:844});await tick(200);await p.screenshot({path:'mob.png'});
// ---- saves from the previous version (one-sided knee, yaw off) are carried over and fixed, trims kept
const q=await b.newPage();await q.addInitScript(()=>{if(!localStorage.getItem('wb2.joints'))localStorage.setItem('wb2.joints',JSON.stringify([{id:'yaw',name:'Hip yaw',ch:4,sign:1,trim:0,lo:1060,hi:1940,on:false,side:'L'},{id:'knee',name:'Knee',ch:1,sign:-1,trim:12,lo:1512,hi:2270,on:true,side:'L'}]))});
await q.goto('http://localhost:8123/index.html');await q.waitForSelector('#jt .jr');
const mk=await q.evaluate(()=>[...document.querySelectorAll('#jt .jr')].length);a.strictEqual(mk,5);
await q.evaluate(()=>document.querySelector('[data-j=knee] [data-a=cal]').click());
await q.fill('[data-j=knee] [data-k=hi]','2270');await q.dispatchEvent('[data-j=knee] [data-k=hi]','change');
const saved=await q.evaluate(()=>JSON.parse(localStorage.getItem('wb3.joints')).find(j=>j.id==='knee'));a.deepStrictEqual([saved.lo,saved.trim,saved.sign],[730,12,-1]);
console.log(errs);a.deepStrictEqual(errs.filter(e=>!/fonts\.g|ERR_|Failed to load resource/.test(e)),[]);console.log('E2E PASS');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
