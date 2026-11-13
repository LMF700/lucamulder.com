'use strict';
/* School Simulator – independent, unofficial College Den Hulster preview.
   The map is data-driven. st: plan = from the supplied Floor Zero plan, tbc = needs confirmation, fiction = prototype filler. */
const CFG={speed:190,limit:10,minPerSec:.4,start:500,world:{w:2860,h:1500}};
const STATUS={plan:'Incorrect.',tbc:'Incorrect.',fiction:'prototype content'};

/* ---------- MAP DATA (edit here, not in the renderer) ---------- */
const R0=[
 {name:'Aula',t:'c',cx:330,cy:700,r:260,col:'#22c55e',st:'plan'},
 {name:'Canteen',x:70,y:1000,w:520,h:330,col:'#22c55e',st:'plan'},
 {code:'D0.08',name:'Music',x:780,y:330,w:240,h:250,col:'#14b8a6',st:'plan'},
 {code:'E0.36',name:'Engineering',x:1250,y:400,w:400,h:340,col:'#3b82f6',st:'plan'},
 {code:'E0.12',name:'Physics',x:1900,y:440,w:300,h:300,col:'#f97316',st:'plan'},
 {code:'F0.118',name:'Art & Design',x:2470,y:560,w:320,h:520,col:'#a855f7',st:'plan'},
 {name:'Locker room',x:900,y:900,w:400,h:280,col:'#9ca3af',st:'tbc'}];
const H0=[{x:640,y:330,w:120,h:1000},{x:640,y:760,w:1810,h:120}];
const ST0=[{x:640,y:200,w:120,h:130},{x:1900,y:880,w:130,h:130}].map(s=>({...s,stair:1}));
const D0=[[580,660,64,80],[580,1130,64,80],[758,410,26,80],[1420,736,60,28],[2020,736,60,28],[1070,878,60,26],[2448,790,26,60]].map(([x,y,w,h])=>({x,y,w,h,door:1}));
const LR=R0.find(r=>r.name==='Locker room'),LOCK=[];
for(let row=0;row<2;row++)for(let i=0;i<12;i++){const x=LR.x+20+i*31;if(!row&&x+28>1060&&x<1140)continue;LOCK.push({x,y:row?LR.y+LR.h-48:LR.y+8,w:28,h:40,own:!row&&i===3})}
const OWN=LOCK.find(l=>l.own),COUNTER={x:100,y:1030,w:220,h:36};
/* Floors: 0 = Floor Zero plan; 1-2 = PROTOTYPE layouts (st:'fiction') sharing the same stairwell positions. */
const flr=(rooms,halls,stairs,doors,solid)=>({rooms,halls,stairs,doors,solid,sh:[...rooms,...halls,...stairs,...doors]});
const rc=(f,i,n)=>'DDEEEEFF'[i]+f+'.'+String(i*2+(n?2:1)).padStart(2,'0');
const FLOORS=[flr(R0,H0,ST0,D0,[...LOCK,COUNTER])];
for(const f of[1,2]){const rm=[{name:f<2?'Library':'Study hall',x:70,y:500,w:520,h:500,col:'#eab308',st:'fiction'}],dr=[[580,700,64,80]],so=[];
 for(let i=0;i<8;i++)for(const n of[1,0]){if(!n&&(i==5||i==6))continue;const x=800+i*200,y=n?500:900;
  rm.push({code:rc(f,i,n),name:'Classroom',x,y,w:190,h:240,col:'#94a3b8',st:'fiction',wb:n?y+6:y+226});dr.push([x+80,n?736:876,30,28]);
  for(let r=0;r<3;r++)for(const c of[24,120])so.push({x:x+c,y:y+60+r*55,w:56,h:30,desk:1})}
 FLOORS.push(flr(rm,H0,ST0,dr.map(([x,y,w,h])=>({x,y,w,h,door:1})),so))}
const ITEMS={Watch:[.1,16,16,'#fde047'],Laptop:[1.8,64,10,'#475569'],'Maths book':[1.1,54,13,'#ef4444'],'Science book':[1.4,54,14,'#22c55e'],'Dutch book':[1,52,12,'#f97316'],'English book':[.9,50,12,'#3b82f6'],'Art portfolio':[2.2,70,12,'#a855f7'],'Sports kit':[3.5,60,30,'#0ea5e9'],'Pencil case':[.3,38,14,'#f59e0b'],'Lunch box':[.5,34,22,'#10b981'],'Water bottle':[.6,46,14,'#38bdf8']};
const START={bag:['Watch','Laptop','Maths book','Science book','Pencil case','Lunch box','Water bottle'],locker:['Dutch book','English book','Art portfolio','Sports kit']};
const BOOK={Maths:'Maths book',Dutch:'Dutch book',Physics:'Science book',English:'English book',Art:'Art portfolio'};
/* Timetable (prototype). D0.08, E0.12, E0.36, F0.118 come from the Floor Zero plan; the other room codes are placeholders. */
const TT=[[510,560,'Maths',rc(1,1,1)],[560,610,'Dutch',rc(1,3,0)],[610,630,'Break'],[630,680,'Physics','E0.12'],[680,730,'English',rc(2,2,1)],[730,770,'Lunch'],[770,820,'Art','F0.118'],[820,870,'Technology','E0.36'],[870,930,'Music','D0.08']];

/* ---------- COLLISION ---------- */
const inShape=(s,x,y)=>s.t==='c'?(x-s.cx)**2+(y-s.cy)**2<=s.r*s.r:x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h;
const free=(x,y)=>SH.some(s=>inShape(s,x,y))&&!SOLID.some(o=>inShape(o,x,y));
const canStand=(x,y)=>free(x-9,y-9)&&free(x+9,y-9)&&free(x-9,y+9)&&free(x+9,y+9);

/* ---------- STATE ---------- */
const $=id=>document.getElementById(id),cv=$('c'),ctx=cv.getContext('2d'),PN=$('panel');
let P,G,fell,watchOn,panel,cur,room,toastT=0,held,drag,PCV,mx=0,my=0,LS,FI=0,ROOMS,HALLS,STAIRS,DOORS,SH,SOLID,USE;
const K={},carried=()=>[...BAGC.items,...(held?[held]:[])],kg=()=>+carried().reduce((a,i)=>a+i.kg,0).toFixed(1),has=n=>carried().some(i=>i.n===n),hasWatch=()=>has('Watch');
const hm=m=>String(m/60%24|0).padStart(2,'0')+':'+String(m%60|0).padStart(2,'0');
const say=(m,s=3)=>{$('toast').textContent=m;$('toast').className='on';toastT=s};
function setFloor(n){FI=n;({rooms:ROOMS,halls:HALLS,stairs:STAIRS,doors:DOORS,sh:SH,solid:SOLID}=FLOORS[n]);room=null;
 USE=[...(n?[]:[{...OWN,t:'open your locker (#117, fictional number)',fn:()=>openPanel('locker')},{...COUNTER,t:'buy a sandwich',fn:()=>{if(G.hunger<15)return say('Not hungry yet.');G.hunger=Math.max(0,G.hunger-35);G.brain=Math.min(100,G.brain+10);say('You ate a sandwich. Hunger and tiredness ease.')}}]),
 ...STAIRS.map(s=>({x:s.x,y:s.y,w:s.w,h:s.h,t:['go up','go up, Q: go down','go down'][n],fn:()=>go(n<2?n+1:n-1),q:()=>n&&n<2&&go(n-1)}))]}
const go=n=>{setFloor(n);say(n?'Floor '+n+'':'Floor 0',4)};
function reset(){P={x:700,y:1260,f:1,mv:0};G={min:CFG.start,hunger:20,sleep:90,brain:100,done:[]};held=null;drag=null;fell=false;watchOn=false;panel=null;cur=null;LS=null;PN.hidden=true;setFloor(0);
 for(const[C,names]of[[BAGC,START.bag],[LOCKC,START.locker]]){C.items=names.map((n,i)=>{const o=body(n,...ITEMS[n]);o.x=C.x+40+(i*53)%(C.w-80);o.y=C.y+20+i*22;o.a=i;return o});for(let i=0;i<200;i++)step(C,1/60)}
 say('Welcome. I could not get as much done as I had hoped, considering my laptop almost burnt up and all.',6)}

/* ---------- INTERACTIONS ---------- */
function nearest(){let b=null,bd=38;for(const u of USE){const d=Math.hypot(Math.max(u.x-P.x,0,P.x-u.x-u.w),Math.max(u.y-P.y,0,P.y-u.y-u.h));if(d<bd){bd=d;b=u}}return b}
function openPanel(m){panel=m;PN.hidden=false;PCV=null;
 if(m==='lesson')PN.innerHTML=`<h3>${LS.s} question <span id=ln></span>/5</h3><p id=lq></p><input id=la autocomplete=off placeholder="Type your answer, press Enter."><p id=lf></p><small>[Esc] to leave the assignment.</small>`,nextQ(true);
 else if(m==='laptop')PN.innerHTML=`<h3>Laptop timetable</h3><table>${TT.map(t=>`<tr${G.min>=t[0]&&G.min<t[1]?' class=now':''}><td>${hm(t[0])}–${hm(t[1])}<td>${t[2]}<td>${t[3]||'–'}`).join('')}</table><small>Room codes are inaccurate, so they'll be in for a surprise. Esc to close.</small>`;
 else{PN.innerHTML='<canvas id=pc width=640 height=400></canvas><small>Drag items with the mouse. Pull one up and out of the opening to hold it; drop it back through the opening to store it. Tab or Esc to close.</small>';PCV=$('pc');PCV.onpointerdown=pdown}
 const i=$('la');i&&i.focus()}
function closePanel(){if(drag)release();panel=null;PCV=null;PN.hidden=true}

/* ---------- INPUT ---------- */
addEventListener('keydown',e=>{const k=e.key.toLowerCase();
 if(e.target.tagName==='INPUT'){if(k==='escape')closePanel();else if(k==='enter')submit();return}
 K[k]=1;if(['tab','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;
 if(k==='r'&&fell)reset();else if(fell)return;
 else if(k==='tab')panel?closePanel():openPanel('bag');
 else if(k==='escape')closePanel();
 else if(k==='e')panel?closePanel():cur&&cur.fn();
 else if(k==='q'&&!panel&&cur&&cur.q)cur.q();
 else if(k==='1'&&!panel){if(!hasWatch())say('You need your watch. It is in your backpack or locker.');else watchOn=!watchOn}});
cv.onclick=()=>{if(panel||fell||!held)return;if(held.n!=='Laptop')return say('You are holding your '+held.n.toLowerCase()+'.');LES()?say("It's taboo to open the laptop. Best not to.",4):openPanel('laptop')};
addEventListener('keyup',e=>K[e.key.toLowerCase()]=0);

/* ---------- UPDATE ---------- */
function update(dt){
 const k=n=>K[n]?1:0;let dx=k('d')+k('arrowright')-k('a')-k('arrowleft'),dy=k('s')+k('arrowdown')-k('w')-k('arrowup');
 if(dx&&dy){dx*=.7071;dy*=.7071}
 const sp=CFG.speed*(1-kg()/40)*(.7+.3*G.sleep/100)*dt;
 if(dx)P.f=dx>0?1:-1;
 if(canStand(P.x+dx*sp,P.y))P.x+=dx*sp;if(canStand(P.x,P.y+dy*sp))P.y+=dy*sp;
 P.mv=dx||dy?P.mv+dt:0;
 const m=dt*CFG.minPerSec;G.min+=m;G.hunger=Math.min(100,G.hunger+m*.13);G.sleep=Math.max(0,G.sleep-m*.05*(G.brain<=0?3:1));if(!LES())G.brain=Math.min(100,G.brain+m*.25);
 if(kg()>CFG.limit){fell=true;say('Gravity strikes again. Press R for a retry.',1e9)}
 const r=ROOMS.find(r=>inShape(r,P.x,P.y));if(r&&r!==room)say((r.code?r.code+' · ':'')+r.name+' – '+STATUS[r.st]);room=r;
 const L=LES();cur=nearest()||(L&&room&&room.code===L[3]&&!G.done.includes(L[2])?{t:'start the '+L[2]+' assignment',fn:()=>startLesson(L)}:null);
 if(G.min>=930&&!G.over){G.over=1;say("School's out. Assignments finished: "+G.done.length+"/"+TT.filter(t=>t[3]).length+".",8)}
 $('prompt').textContent=cur&&!panel?'E: '+cur.t:''}

/* ---------- RENDER ---------- */
function path(s){ctx.beginPath();if(s.t==='c')ctx.arc(s.cx,s.cy,s.r,0,7);else ctx.rect(s.x,s.y,s.w,s.h)}
const tag=(x,y,s,c)=>{const w=ctx.measureText(s).width+18;ctx.fillStyle='#000';ctx.fillRect(x,y,w,22);ctx.fillStyle=c;ctx.fillRect(x,y,6,22);ctx.fillStyle='#fff';ctx.fillText(s,x+12,y+16)};
function person(t){const{x,y}=P,sw=P.mv?Math.sin(t*12)*6:0;ctx.save();
 ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(x,y+14,11,4,0,0,7);ctx.fill();
 if(fell){ctx.translate(x,y+13);ctx.rotate(-1.4*P.f);ctx.translate(-x,-y-13)}
 ctx.strokeStyle='#000';ctx.fillStyle='#e11d48';ctx.lineWidth=3;ctx.lineCap='round';ctx.fillRect(x-P.f*10-4,y-8,8,14);
 ctx.beginPath();ctx.arc(x,y-14,5,0,7);ctx.moveTo(x,y-9);ctx.lineTo(x,y+3);ctx.moveTo(x-6,y-4+sw/2);ctx.lineTo(x,y-7);ctx.lineTo(x+6,y-4-sw/2);
 ctx.moveTo(x,y+3);ctx.lineTo(x-5+sw,y+13);ctx.moveTo(x,y+3);ctx.lineTo(x+5-sw,y+13);ctx.stroke();ctx.restore()}
function draw(t){
 const W=cv.width,H=cv.height,cx=Math.max(0,Math.min(CFG.world.w-W,P.x-W/2))|0,cy=Math.max(0,Math.min(CFG.world.h-H,P.y-H/2))|0;
 ctx.fillStyle='#d9dde1';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-cx,-cy);
 ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=2;
 for(let x=(cx/96|0)*96;x<cx+W;x+=96)for(let y=(cy/64|0)*64;y<cy+H;y+=64){ctx.strokeRect(x+6,y+6,84,52);if((x/96+y/64)%3==0){ctx.fillStyle='#bfe1ff';ctx.fillRect(x+16,y+14,64,36)}}
 ctx.strokeStyle='#111';ctx.lineWidth=18;ctx.lineJoin='round';SH.forEach(s=>{path(s);ctx.stroke()});
 SH.forEach(s=>{path(s);ctx.fillStyle=s.door?'#ffd60a':s.stair?'#ffe066':'#22d13a';ctx.fill()});
 ctx.save();ctx.beginPath();SH.forEach(s=>s.t==='c'?(ctx.moveTo(s.cx+s.r,s.cy),ctx.arc(s.cx,s.cy,s.r,0,7)):ctx.rect(s.x,s.y,s.w,s.h));ctx.clip();
 ctx.strokeStyle='rgba(0,0,0,.09)';ctx.lineWidth=2;for(let x=(cx/48|0)*48;x<cx+W;x+=48){ctx.beginPath();ctx.moveTo(x,cy);ctx.lineTo(x,cy+H);ctx.stroke()}
 for(let y=(cy/48|0)*48;y<cy+H;y+=48){ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx+W,y);ctx.stroke()}ctx.restore();
 ctx.strokeStyle='#111';ctx.lineWidth=3;
 STAIRS.forEach(s=>{for(let y=s.y+14;y<s.y+s.h;y+=16){ctx.beginPath();ctx.moveTo(s.x+8,y);ctx.lineTo(s.x+s.w-8,y);ctx.stroke()}});
 (FI?[]:LOCK).forEach(l=>{ctx.fillStyle=l.own?'#ffd60a':'#60a5fa';ctx.fillRect(l.x,l.y,l.w,l.h);ctx.strokeRect(l.x,l.y,l.w,l.h);ctx.fillStyle='#111';ctx.fillRect(l.x+l.w-9,l.y+l.h/2,3,8)});
 if(!FI){ctx.fillStyle='#f59e0b';ctx.fillRect(COUNTER.x,COUNTER.y,COUNTER.w,COUNTER.h);ctx.strokeRect(COUNTER.x,COUNTER.y,COUNTER.w,COUNTER.h)}
 SOLID.forEach(o=>{if(o.desk){ctx.fillStyle='#e0a458';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeRect(o.x,o.y,o.w,o.h)}});
 ROOMS.forEach(r=>{if(r.wb){ctx.fillStyle='#fff';ctx.fillRect(r.x+30,r.wb,140,8);ctx.strokeRect(r.x+30,r.wb,140,8)}});
 ctx.font='700 14px system-ui';
 ROOMS.forEach(r=>tag(r.t==='c'?r.cx-46:r.x+10,r.t==='c'?r.cy-r.r+28:r.y+10,(r.code?r.code+' ':'')+r.name,r.col));
 STAIRS.forEach(s=>tag(s.x+4,s.y+4,'Stairs','#ffd60a'));
 person(t);ctx.restore()}

/* ---------- HUD ---------- */
const bar=(i,f,t)=>{$('b'+i).style.width=Math.min(100,f*100)+'%';$('v'+i).textContent=t};
function hud(){const w=kg();bar(0,w/CFG.limit,w+' kg');bar(1,G.hunger/100,Math.round(G.hunger));bar(2,G.sleep/100,Math.round(G.sleep)+'%');bar(3,G.brain/100,Math.round(G.brain)+'%');
 $('watch').hidden=!(watchOn&&hasWatch());$('watch').textContent=hm(G.min);$('hand').textContent='Floor '+FI+'. Hand: '+(held?held.n+(held.n==='Laptop'?' (click to open)':''):'empty')}

/* ---------- LESSONS: typed assignments ---------- */
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1)),pick=a=>a[R(0,a.length-1)];
const WORDS=[['hond','dog'],['kat','cat'],['huis','house'],['boek','book'],['fiets','bike'],['school','school']];
const QA={Art:[['Mix red and blue. What color do you see?','purple'],['What is the primary colour between red and blue?','yellow'],['Mix blue and yellow: which colour?','green']],
 Music:[['How many beats is a whole note in 4/4 time?','4'],['How many note letters are there?','7']],
 Technology:[['101 in base 2 equals which number?','5'],['110 in base 2 equals which number?','6'],['1000 in base 2 equals which number?','8']]};
const GEN={Maths:()=>{const a=R(3,12),b=R(3,12),x=R(2,9),k=R(0,2);return k?k>1?['Solve for x:  '+a+'x + '+b+' = '+(a*x+b),x]:[a*b+' ÷ '+a+' = ?',b]:[a+' × '+b+' = ?',a*b]},
 Physics:()=>{const v=R(2,9),t=R(2,9);return['A cyclist rides '+v+' m/s for '+t+' s. How far does the cyclist ride in meters?',v*t]},
 Dutch:()=>{const w=pick(WORDS);return['Type the Dutch word for "'+w[1]+'"',w[0]]},
 English:()=>{const w=pick(WORDS);return['Type the English word for "'+w[0]+'"',w[1]]}};
['Art','Music','Technology'].forEach(s=>GEN[s]=()=>pick(QA[s]));
const LES=()=>TT.find(t=>t[3]&&G.min>=t[0]&&G.min<t[1]);
function startLesson(l){const b=BOOK[l[2]];if(b&&!has(b))return say('You forgot the '+b+'. Fetch it from your locker during a break.',5);
 if(G.brain<=0)return say('Your brain is empty so go eat something.',5);LS={s:l[2],n:0};openPanel('lesson')}
function nextQ(first){[LS.q,LS.a]=GEN[LS.s]();$('ln').textContent=LS.n+1;$('lq').textContent=LS.q;if(!first)$('la').value=''}
function submit(){const v=$('la').value.trim().toLowerCase();if(!v)return;
 if(v===String(LS.a).toLowerCase()){G.brain=Math.max(0,G.brain-4-(100-G.sleep)/15);if(++LS.n>=5){G.done.push(LS.s);closePanel();return say(LS.s+' is done.',4)}nextQ();$('lf').textContent='Indeed.'}
 else{G.brain=Math.max(0,G.brain-1);$('la').value='';$('lf').textContent='Nope. try again.'}}

/* ---------- BACKPACK PHYSICS: rigid bodies made of circles, impulse solver ---------- */
const BAGC={x:40,y:150,w:240,h:230,items:[],name:'Backpack'},LOCKC={x:400,y:110,w:190,h:270,items:[],name:'Locker #117 (fictional)'};
const zones=()=>panel==='locker'?[BAGC,LOCKC]:[BAGC],inZone=(C,o)=>o.x>C.x&&o.x<C.x+C.w&&o.y>C.y-60,pt=(o,c)=>[o.x+c*Math.cos(o.a),o.y+c*Math.sin(o.a)];
function body(n,kg,w,h,c){const k=Math.max(1,Math.round(w/h)),cs=[];for(let i=0;i<k;i++)cs.push(k<2?0:(i/(k-1)-.5)*(w-h));return{n,kg,w,h,c,r:h/2,cs,x:0,y:0,a:0,vx:0,vy:0,va:0,I:kg*(w*w+h*h)/12}}
function hit(a,b,px,py,nx,ny,pen){const ia=1/a.kg,ib=b?1/b.kg:0,t=ia+ib,c=.8*pen/t;a.x-=nx*c*ia;a.y-=ny*c*ia;if(b){b.x+=nx*c*ib;b.y+=ny*c*ib}
 const ax=px-a.x,ay=py-a.y,bx=b?px-b.x:0,by=b?py-b.y:0;let jn=0;
 for(const s of[0,1]){const dx=s?-ny:nx,dy=s?nx:ny,vn=((b?b.vx-b.va*by:0)-(a.vx-a.va*ay))*dx+((b?b.vy+b.va*bx:0)-(a.vy+a.va*ax))*dy,ra=ax*dy-ay*dx,rb=bx*dy-by*dx,k=t+ra*ra/a.I+(b?rb*rb/b.I:0);
  let j=-vn*(s?1:1.25)/k;if(!s){if(vn>0)return;jn=j}else j=Math.max(-.5*jn,Math.min(.5*jn,j));
  a.vx-=j*dx*ia;a.vy-=j*dy*ia;a.va-=j*ra/a.I;if(b){b.vx+=j*dx*ib;b.vy+=j*dy*ib;b.va+=j*rb/b.I}}}
function step(C,dt){const L=C.items,dr=drag&&drag.o,bot=C.y+C.h;
 for(const o of L){if(o===dr){const f=14/(1+o.kg*.5);o.vx=(mx-drag.gx-o.x)*f;o.vy=(my-drag.gy-o.y)*f;o.va*=.8}else o.vy+=900*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.a+=o.va*dt;o.vx*=.995;o.va*=.985}
 for(let k=0;k<4;k++){
  for(const o of L)for(const c of o.cs){const[px,py]=pt(o,c),r=o.r;
   if(py+r>bot)hit(o,null,px,bot,0,1,py+r-bot);if(px-r<C.x)hit(o,null,C.x,py,-1,0,C.x-px+r);if(px+r>C.x+C.w)hit(o,null,C.x+C.w,py,1,0,px+r-C.x-C.w)}
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];if(Math.hypot(a.x-b.x,a.y-b.y)>(a.w+b.w)/2+4)continue;
   for(const ca of a.cs)for(const cb of b.cs){const[ax,ay]=pt(a,ca),[bx,by]=pt(b,cb),d=Math.hypot(bx-ax,by-ay);if(d<a.r+b.r&&d>1e-6)hit(a,b,ax+(bx-ax)/d*a.r,ay+(by-ay)/d*a.r,(bx-ax)/d,(by-ay)/d,a.r+b.r-d)}}}}
const mp=e=>{if(!PCV)return;const r=PCV.getBoundingClientRect();mx=(e.clientX-r.left)*640/r.width;my=(e.clientY-r.top)*400/r.height};
const touch=(o,x,y)=>{const dx=x-o.x,dy=y-o.y,c=Math.cos(o.a),s=Math.sin(o.a);return Math.abs(dx*c+dy*s)<=o.w/2+3&&Math.abs(-dx*s+dy*c)<=o.h/2+3};
function pdown(e){mp(e);if(drag)return;
 if(held&&mx>280&&mx<360&&my>20&&my<95){drag={o:held,C:null,gx:mx-held.x,gy:my-held.y};held=null;return}
 for(const C of zones())for(let i=C.items.length;i--;){const o=C.items[i];if(touch(o,mx,my)){drag={o,C,gx:mx-o.x,gy:my-o.y};return}}}
function release(){const o=drag.o,f=drag.C,to=zones().find(C=>inZone(C,o));drag=null;
 if(to){if(f!==to){f&&f.items.splice(f.items.indexOf(o),1);to.items.push(o)}return}
 if(f&&held){o.y=f.y+10;say("Your hand is full, you aren't Steve, don't be ridiculous.");return}
 if(f)f.items.splice(f.items.indexOf(o),1);o.vx=o.vy=o.va=0;held=o}
addEventListener('pointermove',mp);addEventListener('pointerup',()=>drag&&release());
function tickPanel(dt){if(drag&&!drag.C){const o=drag.o;o.x+=(mx-drag.gx-o.x)*.4;o.y+=(my-drag.gy-o.y)*.4;const z=zones().find(C=>inZone(C,o)&&o.y>C.y);if(z){z.items.push(o);drag.C=z}}
 zones().forEach(C=>step(C,dt));if(held){held.x=320;held.y=60;held.a=0}drawPanel()}
const box=(g,o)=>{g.save();g.translate(o.x,o.y);g.rotate(o.a);g.fillStyle=o.c;g.strokeStyle='#000';g.lineWidth=3;g.fillRect(-o.w/2,-o.h/2,o.w,o.h);g.strokeRect(-o.w/2,-o.h/2,o.w,o.h);g.restore()};
function drawPanel(){const g=PCV.getContext('2d');g.fillStyle='#1c1c1c';g.fillRect(0,0,640,400);g.font='700 13px system-ui';g.lineJoin='round';
 for(const C of zones()){const lk=C===LOCKC;g.strokeStyle='#000';g.lineWidth=5;g.fillStyle=lk?'#3b82f6':'#c2410c';g.fillRect(C.x-12,C.y,C.w+24,C.h+12);
  g.fillStyle=lk?'#14284b':'#431407';g.fillRect(C.x,C.y,C.w,C.h);
  g.beginPath();g.moveTo(C.x,C.y);g.lineTo(C.x-12,C.y);g.lineTo(C.x-12,C.y+C.h+12);g.lineTo(C.x+C.w+12,C.y+C.h+12);g.lineTo(C.x+C.w+12,C.y);g.lineTo(C.x+C.w,C.y);g.stroke();
  g.beginPath();g.moveTo(C.x,C.y);g.lineTo(C.x,C.y+C.h);g.lineTo(C.x+C.w,C.y+C.h);g.lineTo(C.x+C.w,C.y);g.stroke();
  g.fillStyle='#fff';g.fillText(C.name+(lk?'':'. There is an opening at the top'),C.x-12,C.y-12);C.items.forEach(o=>box(g,o))}
 g.strokeStyle='#fff';g.lineWidth=2;g.setLineDash([6,4]);g.strokeRect(280,20,80,75);g.setLineDash([]);g.fillStyle='#fff';g.fillText('In hand',296,14);
 if(held){box(g,held);g.fillText(held.n,284,112)}if(drag&&!drag.C)box(g,drag.o);
 g.fillText(kg()+' kg carried (limit '+CFG.limit+')',420,20)}

/* ---------- LOOP ---------- */
const fit=()=>{cv.width=innerWidth;cv.height=innerHeight};addEventListener('resize',fit);fit();reset();
let last=performance.now();
(function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;
 if(!panel&&!fell)update(dt);else if(PCV)tickPanel(dt);if(--toastT<=0&&(toastT=0,1))$('toast').className='';else toastT+=1-dt;
 draw(now/1000);hud();requestAnimationFrame(loop)})(last);
