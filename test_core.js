// Run: node test_core.js  -- extracts CORE from index.html and checks IK/limits/FK
const fs=require('fs'),a=require('assert');
const h=fs.readFileSync(__dirname+'/index.html','utf8');
const src=h.split('// CORE-BEGIN')[1].split('// CORE-END')[0];
const C=new Function(src+';return {G,DEF,legIK,angLim,clampA,toUs,slew,fk}')();
const near=(x,y,t=.01)=>a(Math.abs(x-y)<t,x+' vs '+y);
let q=C.legIK(8);[-26.513,45.523,-19.010].forEach((v,i)=>near(q[i],v));
q=C.legIK(15);[-37.411,63.660,-26.249].forEach((v,i)=>near(q[i],v));
a.strictEqual(C.legIK(-5),null);
const knee={...C.DEF[2]};let [l,hh]=C.angLim(knee,11);near(l,0);near(hh,70);
[l,hh]=C.angLim({...knee,sign:-1},11);near(l,-70);near(hh,0);
a.strictEqual(C.toUs(C.DEF[1],10,11),1610);
near(C.slew(0,100,.02,60),1.2);
const n=C.fk([0,0,0,0,0]);near(n.shift,0,1e-9);
const s=C.fk([0,...C.legIK(8),0]);near(s.shift,-8,.05);                 // pelvis drops 8 mm
const z=s.foot.map(p=>p[2]);near(Math.max(...z)-Math.min(...z),0,.05);   // foot flat on floor
a.strictEqual(C.DEF.length,10);a.strictEqual(new Set(C.DEF.map(j=>j.ch)).size,10);
a.deepStrictEqual(C.DEF.slice(0,5).map(j=>[j.id,j.ch,j.on]),[['yaw',4,false],['hip',0,true],['knee',1,true],['ankle',2,true],['roll',3,true]]); // no hip yaw yet: ch0 = hip pitch
a.ok(C.DEF.slice(5).every(j=>j.on===false));
a.deepStrictEqual(C.DEF.slice(5).map(j=>[j.side,j.ch]),[9,5,6,7,8].map(c=>['R',c]));
a.ok(C.DEF.slice(5).every((j,i)=>j.id==='r_'+C.DEF[i].id&&j.lo===C.DEF[i].lo));
console.log('CORE PASS');
