(()=>{
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s), buttons=[...document.querySelectorAll('.tool')];
const plots=Array.from({length:12},(_,i)=>({x:190+(i%4)*78,y:[128,211,374][Math.floor(i/4)],w:62,h:55,crop:null}));
const pads=Array.from({length:8},(_,i)=>({x:616+(i%4)*79,y:i<4?169:353,w:58,h:58,tower:null}));
let S, last=performance.now(),toastTimer=0, sound=false, soundCtx;
function fresh(){return{day:1,gold:48,hp:5,water:3,mode:'carrot',phase:'day',crops:plots.map(()=>null),towers:pads.map(()=>null),enemies:[],bullets:[],particles:[],spawnLeft:0,spawnTimer:0,nightKills:0,notice:'',ending:0,muted:!sound}}
freshState();function freshState(){S=fresh();updateUI()}
function say(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
function tone(freq=440,dur=.07,type='sine'){if(!sound)return;try{soundCtx??=new AudioContext();let o=soundCtx.createOscillator(),g=soundCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,soundCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,soundCtx.currentTime+dur);o.connect(g);g.connect(soundCtx.destination);o.start();o.stop(soundCtx.currentTime+dur)}catch{}}
function setMode(m){S.mode=m;buttons.forEach(b=>b.classList.toggle('active',b.dataset.mode===m));let names={carrot:'Choose carrot seeds, then tap an empty furrow.',berry:'Choose moonberry seeds, then tap an empty furrow.',water:'Water a planted crop once per day.',harvest:'Tap ripe crops to gather their gold.',tower:'Place a pea turret on an empty stone pad (30 gold).'};$('#hint').innerHTML=`<strong>${S.phase==='night'?'Night watch.':'Ready.'}</strong> ${names[m]}`}
function updateUI(){ $('#dayStat').textContent=`Day ${Math.min(S.day,5)}`;$('#goldStat').textContent=S.gold;$('#hpStat').textContent='❤'.repeat(Math.max(0,S.hp))+'♡'.repeat(Math.max(0,5-S.hp));$('#waterCount').textContent=`${S.water} / 3 today`;
let night=S.phase==='night'||S.phase==='over'||S.phase==='win';$('#phaseBadge').className='phase'+(night?' night':'');$('#phaseBadge').textContent= S.phase==='night'?'🌙 Night watch':S.phase==='win'?'✨ Farm saved':S.phase==='over'?'🪦 Lost farm':'☀️ Daytime';
$('#phaseBtn').className='primary'+(night?' night-button':'');$('#phaseBtn').textContent=S.phase==='day'?'Start Night →':S.phase==='night'?'Wave in progress…':S.phase==='win'?'Play again ↻':'Try again ↻';$('#phaseBtn').disabled=S.phase==='night';
buttons.forEach(b=>{let dayTool=['carrot','berry','water','harvest'].includes(b.dataset.mode);b.disabled=dayTool&&S.phase!=='day';});
$('#objective').innerHTML=S.phase==='win'?'<b>5 nights survived.</b> The Moonroot farm is safe!':S.phase==='over'?'<b>The homestead fell.</b> Start a new farm and try again.':`Survive <b>5 nights</b> to save the farm. Enemies march along the stone path.`;
$('#hint').innerHTML=`<strong>${S.phase==='night'?'Night watch.':'Plant a little, plan a lot.'}</strong> ${S.phase==='night'?'Your turrets fire automatically. Build more on open pads!':'Choose a tool, then tap a furrow or stone pad.'}`}
function beginNight(){if(S.phase!=='day')return;S.phase='night';S.spawnLeft=3+S.day;S.spawnTimer=.45;S.nightKills=0;S.notice='Night '+S.day;updateUI();say(`Night ${S.day} — ${S.spawnLeft} hungry visitors on the way!`);tone(180,.2,'triangle')}
function dawn(){if(S.phase!=='night')return;S.phase='day';S.day++;S.water=3;
S.crops.forEach((c,i)=>{if(!c)return;c.watered?c.growth+=1:c.growth+=.25;c.watered=false;let max=c.kind==='carrot'?2:3;if(c.growth>=max)c.ready=true});
if(S.day>5){S.phase='win';updateUI();setTimeout(()=>showEnd(true),650);tone(660,.3);return}S.gold+=5;updateUI();say(`Dawn of day ${S.day}! +5 gold · crops have grown.`);tone(520,.1)}
function hitPlot(x,y){return plots.findIndex(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)}function hitPad(x,y){return pads.findIndex(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h)}
function act(x,y){if(S.phase==='over'||S.phase==='win')return;let pi=hitPlot(x,y),ti=hitPad(x,y);
if(pi>=0){let c=S.crops[pi];if(S.phase!=='day'){say('Tend the garden after the night wave.');return}
if(S.mode==='carrot'||S.mode==='berry'){if(c){say('That furrow is already planted.');return}let kind=S.mode,cost=kind==='carrot'?4:7;if(S.gold<cost){say('Not enough gold for those seeds.');return}S.gold-=cost;S.crops[pi]={kind,growth:0,ready:false,watered:false};say(kind==='carrot'?'Carrot seeds planted.':'Moonberry seeds planted.');tone(350,.06)}
else if(S.mode==='water'){if(!c){say('Plant a seed before watering.');return}if(c.ready){say('Already ripe — harvest it!');return}if(c.watered){say('This crop has had its water today.');return}if(!S.water){say('Your watering can is empty today.');return}S.water--;c.watered=true;say('A little drink. This crop will grow at dawn.');tone(480,.08)}
else if(S.mode==='harvest'){if(!c){say('Nothing growing in this furrow yet.');return}if(!c.ready){say('Not ripe yet — keep watering it.');return}let reward=c.kind==='carrot'?13:22;S.gold+=reward;S.crops[pi]=null;say(`Lovely harvest! +${reward} gold.`);tone(700,.1)}
updateUI();return}
if(ti>=0){if(S.mode!=='tower'){say('Stone pads are for pea turrets. Select 🌱 Pea turret first.');return}if(S.towers[ti]){say('That pad already has a turret.');return}if(S.gold<30){say('A pea turret costs 30 gold.');return}S.gold-=30;S.towers[ti]={cool:Math.random()*.5};say('Pea turret planted. It will cover the road automatically!');tone(280,.12,'square');updateUI();return}
if(y>100&&y<455)say(S.mode==='tower'?'Place turrets on the stone pads at the right.':'Tap a furrow to use that tool.')}
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();act((e.clientX-r.left)*1000/r.width,(e.clientY-r.top)*560/r.height)});
buttons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('#phaseBtn').onclick=()=>{if(S.phase==='day')beginNight();else if(S.phase==='win'||S.phase==='over')newGame()};
function newGame(){freshState();setMode('carrot');$('#modal').classList.remove('open');say('A new patch of land, a fresh start.');}
$('#restartBtn').onclick=newGame;$('#closeModal').onclick=()=>$('#modal').classList.remove('open');$('#helpBtn').onclick=()=>$('#modal').classList.add('open');$('#soundBtn').onclick=()=>{sound=!sound;$('#soundBtn').textContent=sound?'♫':'♩';$('#soundBtn').style.background=sound?'#e8f1d7':'';say(sound?'Sound on.':'Sound off.')};
function showEnd(win){$('#modalTitle').textContent=win?'The farm is safe!':'The homestead fell';$('#modalText').textContent=win?'Five nights survived. Your garden glows beneath a quiet moon. You did it!':'The night got through. Every good farmer learns, replants, and tries once more.';$('#modalList').innerHTML=win?'<li>Harvests earned '+S.gold+' gold in the end.</li><li>You survived all five waves and saved Moonroot farm.</li>':'<li>Build a turret early; they fire automatically at enemies on the road.</li><li>Water crops by day, harvest ripe produce, and spend gold wisely.</li>';$('#modal').classList.add('open')}
function spawn(){let n=S.day;let big=n>=3&&Math.random()<.28;S.enemies.push({x:1015,y:286+Math.random()*14,hp:big?3:(n>=4?2:1),max:big?3:(n>=4?2:1),speed:big?35:49+n*2,big,slow:0,hit:0});S.spawnLeft--}
function particles(x,y,color,count=6){for(let i=0;i<count;i++)S.particles.push({x,y,vx:(Math.random()-.5)*95,vy:(Math.random()-.7)*95,life:.45,color})}
function update(dt){dt=Math.min(dt,.05);if(S.phase==='night'){
if(S.spawnLeft>0){S.spawnTimer-=dt;if(S.spawnTimer<=0){spawn();S.spawnTimer=Math.max(.65,1.5-S.day*.08)}}
for(let e of S.enemies){e.hit=Math.max(0,e.hit-dt);if(e.slow>0){e.slow-=dt;e.x-=e.speed*.48*dt}else e.x-=e.speed*dt}
for(let i=0;i<S.towers.length;i++){let t=S.towers[i];if(!t)continue;t.cool-=dt;if(t.cool<=0){let pad=pads[i],tx=pad.x+pad.w/2,ty=pad.y+pad.h/2,target=S.enemies.filter(e=>Math.hypot(e.x-tx,e.y-280)<300).sort((a,b)=>a.x-b.x)[0];if(target){S.bullets.push({x:tx,y:ty,target,life:1.1});t.cool=.68;}}
}
for(let b of S.bullets){if(!b.target||!S.enemies.includes(b.target)){b.life=0;continue}let dx=b.target.x-b.x,dy=b.target.y-b.y,d=Math.hypot(dx,dy),step=420*dt;if(d<step+7){b.target.hp--;b.target.hit=.14;particles(b.target.x,b.target.y,b.target.big?'#f4b267':'#eaf59a',4);b.life=0;tone(250,.025,'sine');if(b.target.hp<=0){S.enemies.splice(S.enemies.indexOf(b.target),1);S.gold+=2;S.nightKills++;particles(b.target.x,b.target.y,'#e9d26c',9)}}else{b.x+=dx/d*step;b.y+=dy/d*step}}
S.bullets=S.bullets.filter(b=>b.life>0);for(let e of [...S.enemies])if(e.x<130){S.enemies.splice(S.enemies.indexOf(e),1);S.hp--;particles(118,285,'#ea795d',12);say('A visitor reached the homestead!');tone(110,.25,'sawtooth');if(S.hp<=0){S.phase='over';updateUI();setTimeout(()=>showEnd(false),550);return}}
if(S.spawnLeft===0&&S.enemies.length===0){S.ending+=dt;if(S.ending>1.3){S.ending=0;dawn()}}else S.ending=0;updateUI()}
for(let p of S.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt}S.particles=S.particles.filter(p=>p.life>0)}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function text(s,x,y,size,color,align='left',font='700'){ctx.fillStyle=color;ctx.font=`${font} ${size}px "DM Sans",system-ui`;ctx.textAlign=align;ctx.fillText(s,x,y)}
function draw(){let night=S.phase!=='day';ctx.clearRect(0,0,1000,560);
// sky, distant hills, meadow
let sky=ctx.createLinearGradient(0,0,0,190);sky.addColorStop(0,night?'#263859':'#92d4c2');sky.addColorStop(1,night?'#60729a':'#d0e7bb');ctx.fillStyle=sky;ctx.fillRect(0,0,1000,180);
ctx.fillStyle=night?'#445d68':'#90bd78';ctx.beginPath();ctx.moveTo(0,166);for(let x=0;x<=1000;x+=80)ctx.lineTo(x,145+Math.sin(x*.018)*16);ctx.lineTo(1000,560);ctx.lineTo(0,560);ctx.fill();
// sun/moon and clouds
if(night){ctx.fillStyle='#f2e7ad';ctx.beginPath();ctx.arc(847,54,24,0,7);ctx.fill();ctx.fillStyle='#263859';ctx.beginPath();ctx.arc(858,44,22,0,7);ctx.fill();for(let i=0;i<34;i++){let x=(i*173+42)%985,y=(i*71+18)%145;ctx.fillStyle=`rgba(255,244,190,${.35+(i%4)*.13})`;ctx.fillRect(x,y,2,2)}}else{ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(847,54,28,0,7);ctx.fill();ctx.fillStyle='#ffffff3a';ctx.beginPath();ctx.ellipse(80,60,55,13,0,0,7);ctx.ellipse(112,60,31,9,0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(690,100,64,13,0,0,7);ctx.ellipse(725,100,31,9,0,0,7);ctx.fill()}
// grass stipple
for(let i=0;i<72;i++){let x=(i*139+31)%1000,y=120+(i*83+11)%430;ctx.fillStyle=night?'#d9e7a322':'#fff8bd48';ctx.fillRect(x,y,2,3)}
// path
ctx.fillStyle=night?'#384256':'#b9a783';ctx.beginPath();ctx.moveTo(0,257);ctx.quadraticCurveTo(400,248,1000,260);ctx.lineTo(1000,314);ctx.quadraticCurveTo(570,305,0,319);ctx.fill();ctx.strokeStyle=night?'#68718a':'#d8c99e';ctx.lineWidth=2;ctx.setLineDash([12,12]);ctx.beginPath();ctx.moveTo(0,286);ctx.lineTo(1000,286);ctx.stroke();ctx.setLineDash([]);
// farmhouse
ctx.fillStyle='#47664a';ctx.beginPath();ctx.ellipse(107,314,79,73,0,0,7);ctx.fill();ctx.fillStyle='#f1d89d';ctx.fillRect(61,209,94,82);ctx.fillStyle='#bf7454';ctx.beginPath();ctx.moveTo(48,214);ctx.lineTo(107,169);ctx.lineTo(168,214);ctx.closePath();ctx.fill();ctx.fillStyle='#f4e3b9';ctx.fillRect(72,233,22,24);ctx.fillRect(121,233,22,24);ctx.fillStyle='#7297a0';ctx.fillRect(76,237,14,16);ctx.fillRect(125,237,14,16);ctx.fillStyle='#73503b';ctx.fillRect(99,254,22,37);ctx.fillStyle='#f4da91';ctx.beginPath();ctx.arc(117,273,2,0,7);ctx.fill();text('HOME',108,305,9,'#f5e5bb','center','800');
// fence
ctx.strokeStyle=night?'#576759':'#d7c58c';ctx.lineWidth=4;for(let x=175;x<530;x+=28){ctx.beginPath();ctx.moveTo(x,112);ctx.lineTo(x,126);ctx.stroke()}ctx.beginPath();ctx.moveTo(175,117);ctx.lineTo(520,117);ctx.stroke();
// labels
text('YOUR GARDEN',331,104,11,night?'#e2e8bc':'#4b704e','center','800');text('THE MOONLIT ROAD',752,240,10,night?'#d7dce9':'#6d6655','center','800');text('DEFENSE LINE',775,143,10,night?'#c2d1ed':'#54744d','center','800');
// crop plots
plots.forEach((p,i)=>{roundRect(p.x,p.y+5,p.w,p.h,9,'#ffffff25');roundRect(p.x,p.y,p.w,p.h,8,'#795b3b','#62482f');roundRect(p.x+5,p.y+5,p.w-10,p.h-10,5,'#8f714b');for(let r=0;r<3;r++){ctx.strokeStyle='#6d5138';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+9,p.y+14+r*13);ctx.quadraticCurveTo(p.x+31,p.y+10+r*13,p.x+p.w-9,p.y+14+r*13);ctx.stroke()}
let c=S.crops[i];if(c){let cx=p.x+p.w/2,cy=p.y+p.h/2+3,stage=c.ready?3:Math.min(2,Math.floor(c.growth));let leafy=c.kind==='carrot'?'#65a756':'#4e8d67';ctx.fillStyle='#477341';ctx.fillRect(cx-2,cy+3,4,14);for(let l=0;l<(stage===0?2:stage===1?4:6);l++){let a=l/6*Math.PI*2;ctx.fillStyle=leafy;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*7,cy-4+Math.sin(a)*6,6,3,a,0,7);ctx.fill()}
if(c.kind==='carrot'&&stage>=1){ctx.fillStyle='#f08d48';ctx.beginPath();ctx.moveTo(cx-4,cy+5);ctx.lineTo(cx+4,cy+5);ctx.lineTo(cx,cy+16);ctx.closePath();ctx.fill()}if(c.kind==='berry'&&stage>=2){ctx.fillStyle='#60469a';ctx.beginPath();ctx.arc(cx+4,cy-7,5,0,7);ctx.fill();ctx.fillStyle='#91b970';ctx.fillRect(cx+1,cy-13,5,2)}if(c.ready){ctx.fillStyle='#f8e388';ctx.beginPath();ctx.arc(cx+20,cy-14,6,0,7);ctx.fill();text('✓',cx+20,cy-11,8,'#47633e','center','800')}if(c.watered&&S.phase==='day'){text('💧',p.x+p.w-11,p.y+16,12,'white','center')}}else if(S.mode==='carrot'||S.mode==='berry'){ctx.fillStyle='#ffffff4a';ctx.beginPath();ctx.arc(p.x+p.w-11,p.y+12,3,0,7);ctx.fill()}});
// turret pads
pads.forEach((p,i)=>{roundRect(p.x,p.y+4,p.w,p.h,12,'#0000001c');roundRect(p.x,p.y,p.w,p.h,12,p.tower?'#768b59':night?'#647353':'#91aa6e',p.tower?'#435943':'#7b925e');ctx.fillStyle='#ffffff32';ctx.beginPath();ctx.arc(p.x+13,p.y+13,3,0,7);ctx.fill();if(p.tower){let cx=p.x+p.w/2,cy=p.y+p.h/2;ctx.fillStyle='#395741';ctx.beginPath();ctx.arc(cx,cy+6,19,0,7);ctx.fill();ctx.fillStyle='#73b95f';ctx.beginPath();ctx.arc(cx-3,cy,14,0,7);ctx.fill();ctx.fillStyle='#a1d474';ctx.beginPath();ctx.arc(cx+1,cy-3,9,0,7);ctx.fill();ctx.strokeStyle='#476b48';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(cx+5,cy);ctx.lineTo(cx+19,cy-7);ctx.stroke();ctx.fillStyle='#f3dd8b';ctx.beginPath();ctx.arc(cx-1,cy+2,3,0,7);ctx.fill()}else{text('＋',p.x+p.w/2,p.y+37,19,'#e7ebd1','center')}});
// range indicator selected placement mode
if(S.mode==='tower'&&S.phase==='day'){ctx.strokeStyle='#ebedb07a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(760,280,280,0,7);ctx.stroke()}
// projectiles and enemies
for(let b of S.bullets){ctx.fillStyle='#e9ef91';ctx.beginPath();ctx.arc(b.x,b.y,4,0,7);ctx.fill();ctx.fillStyle='#fff9b344';ctx.beginPath();ctx.arc(b.x,b.y,8,0,7);ctx.fill()}
S.enemies.forEach((e,i)=>{let bob=Math.sin(performance.now()/140+i)*2,x=e.x,y=e.y+bob;ctx.fillStyle='#00000033';ctx.beginPath();ctx.ellipse(x,y+21,13,5,0,0,7);ctx.fill();ctx.fillStyle=e.hit?'#f7d893':e.big?'#8c5c6e':'#8d8058';ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fill();ctx.fillStyle=e.big?'#d8a0a4':'#c3d28b';ctx.beginPath();ctx.arc(x-4,y-2,2,0,7);ctx.arc(x+4,y-2,2,0,7);ctx.fill();ctx.fillStyle='#25302b';ctx.fillRect(x-5,y+5,10,2);ctx.fillStyle='#5d4451';ctx.fillRect(x-10,y+12,7,9);ctx.fillRect(x+3,y+12,7,9);ctx.fillStyle='#302e37';ctx.fillRect(x-13,y-21,26,4);ctx.fillStyle='#e68b66';ctx.fillRect(x-13,y-21,26*Math.max(0,e.hp/e.max),4)});
// particles
for(let p of S.particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,7);ctx.fill();ctx.globalAlpha=1}
// night tint + vignette
if(night){ctx.fillStyle='#17264820';ctx.fillRect(0,0,1000,560);let vg=ctx.createRadialGradient(500,270,120,500,270,650);vg.addColorStop(0,'#1c284100');vg.addColorStop(1,'#101d4738');ctx.fillStyle=vg;ctx.fillRect(0,0,1000,560)}
// day progress cue
if(S.phase==='night'){roundRect(25,28,147,31,10,'#182742b9');text(`WAVE ${S.day}  ·  ${S.spawnLeft+S.enemies.length} LEFT`,98,48,10,'#f6e8aa','center','800')}else if(S.phase==='day'){roundRect(25,28,113,31,10,'#ffffffe0');text(`DAY ${S.day}  ·  ${S.water} 💧`,81,48,10,'#3f6848','center','800')}
}
function frame(now){update((now-last)/1000);last=now;draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').classList.remove('open')});
window.addEventListener('keydown',e=>{let keys={'1':'carrot','2':'berry','3':'water','4':'harvest','5':'tower'};if(keys[e.key]&&S.phase==='day')setMode(keys[e.key]);if(e.key===' '&&S.phase==='day'){e.preventDefault();beginNight()}if(e.key==='Escape')$('#modal').classList.remove('open')});
setMode('carrot');
})();