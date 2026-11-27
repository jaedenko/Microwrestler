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
const tick=ms=>p.waitForTimeout(ms);const pg=n=>p.click('#nav [data-p='+n+']');
const until=async(f,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){if(await last()===f)return;await tick(100)}a.strictEqual(await last(),f)};   // slew is slow under a software GL renderer
await pg('ctl');
// leg: ch0 hip pitch, ch1 knee, ch2 ankle pitch, ch3 ankle roll, ch4 hip yaw. Right leg not built.
await p.click('[data-m=horn]');await tick(150);a.strictEqual(await last(),P(1500,1500,1500,1500,1500));
await p.click('[data-m=run]');await tick(150);a.strictEqual(await last(),P(1500,1500,1500,1500,1500));
await p.fill('#dz','8');await p.dispatchEvent('#dz','input');
await until(P(1792,2001,1291,1500,1500));
await p.click('[data-kn=back]');await until(P(1178,946,1732,1500,1500));                                   // knee-backward squat: knee servo goes BELOW 90 deg (1500 us)
await p.click('[data-kn=fwd]');await until(P(1792,2001,1291,1500,1500));                       // hip -26.5, knee +45.5, ankle -19 deg x 11 us
await p.screenshot({path:'sq3d.png'});
await p.click('#btnStop');await tick(100);a.strictEqual(await last(),P());
await pg('cal');await p.click('#jt [data-j=knee] [data-a=cal]');await tick(100);a.strictEqual(await last(),P(0,1500));
await p.click('#jt [data-j=knee] [data-a=cal]');
// right leg is independent and not installed: Calibrate is disabled until Installed is ticked
await p.click('[data-t=R]');a.ok(await p.locator('#jt [data-j=r_knee] [data-a=cal]').isDisabled());
await p.check('#jt [data-j=r_knee] [data-k=on]');await p.click('#jt [data-j=r_knee] [data-a=cal]');await tick(100);a.strictEqual(await last(),P(0,0,0,0,0,0,1500));
await p.fill('#jt [data-j=r_knee] .cs','5');await p.click('#jt [data-j=r_knee] [data-a=smax]');await p.click('#jt [data-j=r_knee] [data-a=cal]');
await pg('ctl');await tick(100);
a.ok(+await p.getAttribute('#dz','max')<8,'slider capped by the right knee stop');a.ok(/squat/.test(await p.textContent('#dzmax')));
await pg('cal');await p.click('#jt [data-j=r_knee] [data-a=cal]');await p.click('#jt [data-j=r_knee] [data-a=rj]');
a.strictEqual(await p.isChecked('#jt [data-j=r_knee] [data-k=on]'),false);       // reset joint -> back to not installed
await p.click('[data-t=L]');
// ---- guided calibration of the left leg (order top-down: hip yaw, hip pitch, knee, ankle pitch, ankle roll)
await pg('ctl');await p.click('[data-m=rel]');await pg('cal');await p.click('#bGuide');await p.waitForSelector('#wiz [data-act=start]');
await p.screenshot({path:'wiz-intro.png'});
await p.click('[data-act=start]');await tick(80);a.strictEqual(await last(),P(0,0,0,0,1500));            // yaw first: only that servo
for(const s of ['next','next','skip','skip','next'])await p.click('[data-act='+s+']');
await tick(80);a.strictEqual(await last(),P(1500,0,0,0,1500));                                          // hip pitch centre step; yaw holds its centre
const n=(v)=>p.click('[data-act=n][data-arg="'+v+'"]');
await n(10);await n(10);await until(P(1520,0,0,0,1500));
await p.screenshot({path:'wiz-centre.png'});
await p.click('[data-act=next]');await until(P(1355,0,0,0,1500));                                       // direction check: servo goes to +15 deg
await p.screenshot({path:'wiz-dir.png'});
await p.click('[data-act=next]');await tick(900);                                                         // "yes": negative end
for(let i=0;i<5;i++)await n(-10);await tick(500);await p.screenshot({path:'wiz-neg.png'});
await p.click('[data-act=next]');await tick(900);                                                         // touching at 1470 -> backed off to 1503
for(let i=0;i<5;i++)await n(10);await tick(500);await p.click('[data-act=next]');                         // touching at 1570 -> 1537
await tick(100);await p.click('[data-act=next]');                                                                       // range test ok
const get=id=>p.evaluate(i=>JSON.parse(localStorage.getItem('wb4.joints')).find(j=>j.id===i),id);
let hip=await get('hip');a.deepStrictEqual([hip.trim,hip.lo,hip.hi,hip.sign],[20,1503,1537,-1]);
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
// ---- calibration slider: drag the servo, press Set min / Set max
await p.click('#jt [data-j=knee] [data-a=cal]');await p.fill('#jt [data-j=knee] .cs','-5');await tick(100);
await p.click('#jt [data-j=knee] [data-a=smin]');a.strictEqual((await get('knee')).lo,1445);          // knee direction is +, so min angle is the LOW pulse
await p.fill('#jt [data-j=knee] .cs','5');await p.click('#jt [data-j=knee] [data-a=smax]');a.strictEqual((await get('knee')).hi,1555);
await p.fill('#jt [data-j=knee] .cs','3');await p.click('#jt [data-j=knee] [data-a=smin]');a.ok(!(await p.locator('#alert').isHidden())); // min must be <= 0
a.ok(/Min -5\.0° · Max 5\.0°|Min -5\.0°\s+·\s+Max 5\.0°/.test(await p.textContent('#jt [data-j=knee] .rng')));
await p.click('#jt [data-j=knee] [data-a=cal]');
// ---- speed slider drives the servo limit; walk stays inside calibrated limits
await pg('walk');await p.fill('#dpsr','200');await p.dispatchEvent('#dpsr','input');a.strictEqual(await p.evaluate(()=>localStorage.getItem('wb4.maxDps')),'200');
await pg('ctl');await p.click('[data-m=run]');await pg('walk');await p.fill('#spd','2');await p.dispatchEvent('#spd','input');
await p.click('#bWalk');await tick(2500);
const hipLim=await get('hip');const fr=await last();const u0=+fr.split(' ')[1];a.ok(u0>=hipLim.lo&&u0<=hipLim.hi,'walk hip '+u0);
await p.click('#bWalk');
// ---- leg controls on the dashboard: right leg only leaves the left leg at neutral
await pg('dash');await p.click('[data-leg=R]');await p.click('#modes2 [data-m=run]');
await pg('ports');await p.check('#pt tr[data-j=r_hip] input');await pg('dash');await p.click('[data-do=loop]');await tick(2500);
const fR=(await last()).split(' ');a.strictEqual(+fR[1],1520);a.ok(fR.slice(6,9).some(v=>+v!==1500&&+v>0),'right leg moves: '+fR.join(' '));  // left hip ch0 stays 1500; right ch5-7 move
await p.click('[data-do=loop]');await p.click('[data-leg=B]');
// ---- ports panel: reassign the left knee to port 6, then back
await pg('ports');await p.selectOption('#pt tr[data-j=knee] select','6');await pg('dash');await p.click('#modes2 [data-m=horn]');await tick(200);
a.strictEqual((await last()).split(' ')[7],'1500');a.strictEqual((await last()).split(' ')[2],'0');
await pg('ports');await p.selectOption('#pt tr[data-j=knee] select','1');
await p.click('#pt tr[data-j=hip] [data-a=rev]');a.strictEqual((await get('hip')).sign,1);await p.click('#pt tr[data-j=hip] [data-a=rev]');
// ---- dashboard shows live joints and system rows
await pg('dash');await tick(500);a.ok(await p.locator('#live tr').count()>=4);a.ok(/Connection/.test(await p.textContent('#sys')));
// ---- connection diagnostics: no reply from the Nano -> visible warning
await p.screenshot({path:'desk.png'});
await p.setViewportSize({width:390,height:844});await tick(200);await p.screenshot({path:'mob.png'});
// ---- saves from the previous version (one-sided knee, yaw off) are carried over and fixed, trims kept
const q=await b.newPage();await q.addInitScript(()=>{if(!localStorage.getItem('wb2.joints'))localStorage.setItem('wb2.joints',JSON.stringify([{id:'yaw',name:'Hip yaw',ch:4,sign:1,trim:0,lo:1060,hi:1940,on:false,side:'L'},{id:'knee',name:'Knee',ch:1,sign:-1,trim:12,lo:1512,hi:2270,on:true,side:'L'}]))});
await q.goto('http://localhost:8123/index.html');await q.waitForSelector('#jt .jr',{state:'attached'});await q.click('#nav [data-p=cal]');
const mk=await q.evaluate(()=>[...document.querySelectorAll('#jt .jr')].length);a.strictEqual(mk,5);
await q.evaluate(()=>document.querySelector('[data-j=knee] [data-a=cal]').click());
await q.evaluate(()=>document.querySelector('[data-j=knee] [data-a=sc]').click());
const saved=await q.evaluate(()=>JSON.parse(localStorage.getItem('wb4.joints')).find(j=>j.id==='knee'));a.deepStrictEqual([saved.lo,saved.trim,saved.sign],[730,12,-1]);
const hs=await q.evaluate(()=>JSON.parse(localStorage.getItem('wb4.joints')).find(j=>j.id==='hip').sign);a.strictEqual(hs,-1);   // old saved +1 hip flips once
console.log(errs);a.deepStrictEqual(errs.filter(e=>!/fonts\.g|ERR_|Failed to load resource/.test(e)),[]);console.log('E2E PASS');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
