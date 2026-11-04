(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const shell = document.querySelector('#gameShell');
  const $ = (id) => document.getElementById(id);
  const hud = { rings: $('ringCount'), score: $('scoreCount'), time: $('timeCount'), progress: $('progressFill'), toast: $('toast'), combo: $('comboCount'), boost: $('boostFill') };
  const WORLD_END = 6550, GROUND = 600;
  const platforms = [
    {x:480,y:500,w:210,h:24},{x:900,y:450,w:190,h:24},{x:1330,y:510,w:245,h:24},
    {x:1810,y:455,w:210,h:24},{x:2220,y:500,w:280,h:24},{x:2760,y:440,w:220,h:24},
    {x:3190,y:495,w:240,h:24},{x:3650,y:440,w:240,h:24},{x:4110,y:500,w:220,h:24},
    {x:4550,y:455,w:260,h:24},{x:5100,y:500,w:250,h:24},{x:5580,y:445,w:240,h:24}
  ];
  const gaps = [[780,855],[1160,1230],[1610,1695],[2050,2130],[2580,2660],[3030,3110],[3480,3560],[3970,4050],[4400,4480],[4900,4980],[5400,5480],[5920,6000]];
  const springs = [720,1280,2120,2695,3590,4470,5500];
  const enemies = [
    {x:1090,min:1040,max:1140,dir:1},{x:1730,min:1700,max:1790,dir:-1},{x:2500,min:2510,max:2570,dir:1},
    {x:3370,min:3330,max:3420,dir:-1},{x:4260,min:4210,max:4300,dir:1},{x:5210,min:5160,max:5250,dir:-1},{x:6020,min:5990,max:6080,dir:1}
  ];
  const rings = [];
  for(let section=0;section<13;section++){
    const base=190+section*490;
    for(let i=0;i<5;i++) rings.push({x:base+i*38,y:(i===2?GROUND-112:GROUND-58-Math.sin(i/4*Math.PI)*44),got:false});
    if(section%2===0) for(let i=0;i<4;i++) rings.push({x:base+205+i*36,y:GROUND-116-Math.sin(i/3*Math.PI)*55,got:false});
  }
  let view={w:1280,h:720,scale:1,dpr:1}, player, camera=0, state='intro', last=0, elapsed=0, score=0, ringCount=0, combo=0, comboTimer=0, bestScore=0, particles=[], shake=0, toastTimer=0, audio=null, soundOn=true, prevJump=false, checkpoint=120;
  try { bestScore=Number(localStorage.getItem('neonDashBest')||0)||0; } catch (_) { bestScore=0; }
  const keys={left:false,right:false,boost:false,jump:false};

  function resize(){
    const rect=shell.getBoundingClientRect(); view.dpr=Math.min(devicePixelRatio||1,2); view.scale=rect.height/720; view.h=720; view.w=rect.width/view.scale;
    canvas.width=Math.round(rect.width*view.dpr);canvas.height=Math.round(rect.height*view.dpr);
    canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';
    ctx.setTransform(view.dpr*view.scale,0,0,view.dpr*view.scale,0,0);
  }
  addEventListener('resize',resize,{passive:true}); resize();
  function fresh(){
    rings.forEach(r=>r.got=false);enemies.forEach(e=>{e.dead=false;e.x=e.min+(e.max-e.min)*.5});
    player={x:120,y:GROUND,vx:0,vy:0,w:38,h:48,onGround:true,boosting:false,invuln:0,anim:0,facing:1,stamina:1,checkpoint:120};
    score=0;ringCount=0;combo=0;comboTimer=0;elapsed=0;camera=0;particles=[];checkpoint=120;hudUpdate();
  }
  function start(){fresh();state='playing';shell.classList.add('playing');shell.classList.remove('paused');$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','Pause game');$('introCard').classList.add('hidden');$('resultCard').classList.add('hidden');$('pauseCard').classList.add('hidden');last=performance.now();}
  function togglePause(){if(state==='playing'){state='paused';shell.classList.add('paused');$('pauseCard').classList.remove('hidden');$('pauseButton').textContent='▶';$('pauseButton').setAttribute('aria-label','Resume game')}else if(state==='paused'){state='playing';shell.classList.remove('paused');$('pauseCard').classList.add('hidden');$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','Pause game');prevJump=keys.jump;last=performance.now()}}
  $('startButton').addEventListener('click',start);$('restartButton').addEventListener('click',start);
  $('pauseButton').addEventListener('click',togglePause);$('resumeButton').addEventListener('click',togglePause);
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundButton').innerHTML=`♫ <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(soundOn)beep(540,.07,'sine',.04)});
  addEventListener('keydown',e=>{
    const k=e.code;
    if(['ArrowLeft','ArrowRight','ArrowUp','Space','ShiftLeft','ShiftRight','KeyA','KeyD','KeyW','Escape'].includes(k))e.preventDefault();
    if(k==='Escape'){togglePause();return}
    if(k==='ArrowLeft'||k==='KeyA')keys.left=true;if(k==='ArrowRight'||k==='KeyD')keys.right=true;
    if(k==='ShiftLeft'||k==='ShiftRight'||k==='KeyX')keys.boost=true;
    if(k==='Space'||k==='ArrowUp'||k==='KeyW')keys.jump=true;
    if((k==='Enter'||k==='Space')&&(state==='intro'||state==='result'))start();
    else if((k==='Enter'||k==='Space')&&state==='paused')togglePause();
  });
  addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false;if(['ShiftLeft','ShiftRight','KeyX'].includes(e.code))keys.boost=false;if(['Space','ArrowUp','KeyW'].includes(e.code))keys.jump=false;});
  document.querySelectorAll('[data-control]').forEach(btn=>{
    const key=btn.dataset.control;
    const set=(v,e)=>{e.preventDefault();keys[key]=v;btn.classList.toggle('active',v)};
    btn.addEventListener('pointerdown',e=>{btn.setPointerCapture(e.pointerId);set(true,e)});
    btn.addEventListener('pointerup',e=>set(false,e));btn.addEventListener('pointercancel',e=>set(false,e));btn.addEventListener('lostpointercapture',e=>set(false,e));
  });
  function beep(freq,duration,type='sine',volume=.06){
    if(!soundOn)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(_){ }
  }
  function fmt(n){return String(n).padStart(2,'0')}
  function hudUpdate(){hud.rings.textContent=fmt(ringCount);hud.score.textContent=String(score).padStart(6,'0');hud.time.textContent=`${fmt(Math.floor(elapsed/60))}:${fmt(Math.floor(elapsed%60))}`;hud.progress.style.width=`${Math.min(100,player?player.x/WORLD_END*100:0)}%`;hud.combo.textContent=`x${Math.max(1,Math.min(5,1+Math.floor(combo/3)))}`;hud.boost.style.width=`${Math.round((player?player.stamina:1)*100)}%`}
  function toast(msg){hud.toast.textContent=msg;hud.toast.classList.add('show');toastTimer=1.3}
  function burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*240;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-70,life:.45+Math.random()*.55,max:.9,color,size:2+Math.random()*3})}}
  function update(dt){
    if(state!=='playing')return;
    elapsed+=dt;comboTimer=Math.max(0,comboTimer-dt);if(!comboTimer)combo=0;toastTimer=Math.max(0,toastTimer-dt);if(!toastTimer)hud.toast.classList.remove('show');
    const p=player; p.anim+=dt*(Math.abs(p.vx)*.04+2);p.invuln=Math.max(0,p.invuln-dt);
    const input=(keys.right?1:0)-(keys.left?1:0);if(input)p.facing=input;
    const boost=keys.boost&&p.stamina>.02&&Math.abs(p.vx)>100;
    p.boosting=boost;
    const maxSpeed=boost?850:560, accel=p.onGround?1750:1000;
    if(input)p.vx+=input*accel*dt;else p.vx*=Math.pow(p.onGround?.84:.975,dt*60);
    if(boost)p.stamina=Math.max(0,p.stamina-dt*.42);else p.stamina=Math.min(1,p.stamina+dt*.17);
    p.vx=Math.max(-maxSpeed,Math.min(maxSpeed,p.vx));
    if(keys.jump&&!prevJump){if(p.onGround){p.vy=-680;p.onGround=false;beep(280,.13,'triangle',.06)}else if(p.vy>80){p.vy=-520;beep(350,.11,'triangle',.05)}}
    if(!keys.jump&&p.vy< -260)p.vy+=1050*dt;
    prevJump=keys.jump;
    const oldY=p.y;p.vy+=1700*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.x=Math.max(25,Math.min(WORLD_END-15,p.x));
    // Landing on the continuous track, gaps, and raised ledges.
    let support=!gaps.some(g=>p.x>g[0]-10&&p.x<g[1]+10), landingY=GROUND;
    for(const plat of platforms){if(p.x+15>plat.x&&p.x-15<plat.x+plat.w&&oldY<=plat.y&&p.y>=plat.y&&p.vy>=0){if(plat.y<landingY){landingY=plat.y;support=true}}}
    if(support&&p.y>=landingY&&p.vy>=0){p.y=landingY;p.vy=0;p.onGround=true}else p.onGround=false;
    for(const sx of springs){if(Math.abs(p.x-sx)<26&&Math.abs(p.y-GROUND)<8&&p.onGround){p.vy=-870;p.onGround=false;p.vx=Math.max(p.vx,390);beep(610,.18,'sine',.07);burst(sx,GROUND-7,'#b8ff6a',10);toast('SPRING BOOST!')}}
    if(p.x>checkpoint+420){checkpoint=p.x;p.checkpoint=Math.floor(p.x);}
    if(p.y>820){p.x=Math.max(25,checkpoint-35);p.y=GROUND;p.vy=0;p.vx=100;p.invuln=1.5;shake=9;toast('BACK IN THE RUN!');}
    for(const r of rings){if(!r.got&&Math.hypot(p.x-r.x,p.y-25-r.y)<35){r.got=true;ringCount++;combo++;comboTimer=1.65;const multiplier=Math.min(5,1+Math.floor(combo/3));score+=100*multiplier;beep(760+(ringCount%5)*90,.075,'sine',.045);burst(r.x,r.y,'#c7ff70',5);if(combo===3||combo===6||combo===9||combo===12)toast(`SHARD CHAIN x${multiplier}!`)}}
    for(const e of enemies){if(e.dead)continue;e.x+=e.dir*65*dt;if(e.x<e.min||e.x>e.max)e.dir*=-1;if(Math.abs(p.x-e.x)<34&&Math.abs((p.y-20)-(GROUND-22))<38){if(p.vy>100){e.dead=true;p.vy=-420;score+=250;burst(e.x,GROUND-25,'#ffb160',12);beep(420,.12,'square',.04)}else if(!p.invuln){combo=0;comboTimer=0;if(ringCount){ringCount=Math.max(0,ringCount-10);for(let n=0;n<Math.min(10,ringCount+10);n++)burst(p.x,p.y-22,'#c7ff70',1);p.invuln=1.4;p.vx=-p.facing*320;p.vy=-300;shake=8;toast('SHARDS SCATTERED!')}else{p.invuln=1.6;p.vx=-p.facing*350;p.vy=-340;shake=8;toast('WATCH YOUR STEP!')}beep(130,.2,'sawtooth',.05)}}}
    if(p.x>WORLD_END-100){finish(true);return}
    const target=Math.max(0,Math.min(WORLD_END-view.w*.72,p.x-view.w*.32));camera+=(target-camera)*Math.min(1,dt*4.5);
    for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=340*dt;q.life-=dt}particles=particles.filter(q=>q.life>0);
    shake=Math.max(0,shake-dt*20);hudUpdate();
  }
  function finish(win){state='result';shell.classList.remove('playing','paused');$('pauseCard').classList.add('hidden');$('resultCard').classList.remove('hidden');const timeBonus=win?Math.max(0,10000-Math.floor(elapsed*100)):0;const finalScore=score+timeBonus;const record=finalScore>bestScore;if(record){bestScore=finalScore;try{localStorage.setItem('neonDashBest',String(bestScore))}catch(_){}}$('resultTitle').textContent=win?'SKYLINE CONQUERED.':'NICE RUN.';$('resultCopy').textContent=record?(win?'NEW PERSONAL BEST — the skyline belongs to you.':'NEW SCORE BEST — one more run to claim the skyline?'):win?`Time bonus +${timeBonus.toLocaleString()} — ready for another lap?`:'The skyline is yours. One more run?';$('finalRings').textContent=fmt(ringCount);$('finalScore').textContent=String(finalScore).padStart(6,'0');$('bestScore').textContent=String(bestScore).padStart(6,'0');$('finalTime').textContent=hud.time.textContent;beep(520,.15,'sine',.05);setTimeout(()=>beep(700,.2,'sine',.05),120)}
  function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function drawBackground(){
    const w=view.w;let g=ctx.createLinearGradient(0,0,0,720);g.addColorStop(0,'#11163d');g.addColorStop(.48,'#493477');g.addColorStop(1,'#fb8e77');ctx.fillStyle=g;ctx.fillRect(0,0,w,720);
    // atmospheric sun and fine radial bloom
    const sunX=w*.72-camera*.018,sunY=230;let sg=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,185);sg.addColorStop(0,'rgba(255,230,164,.8)');sg.addColorStop(.2,'rgba(255,174,157,.42)');sg.addColorStop(1,'rgba(255,166,193,0)');ctx.fillStyle=sg;ctx.fillRect(sunX-190,sunY-190,380,380);ctx.fillStyle='#ffddb0';ctx.beginPath();ctx.arc(sunX,sunY,52,0,Math.PI*2);ctx.fill();
    // star dots
    for(let i=0;i<55;i++){let x=((i*197+60-camera*.035)%(w+10)+w+10)%(w+10),y=45+(i*83%220);ctx.globalAlpha=.22+(i%4)*.1;ctx.fillStyle='#fff';ctx.fillRect(x,y,i%7===0?2:1,1)}ctx.globalAlpha=1;
    // distant city layers
    drawCity(.12,510,'#373263',40,100,.18);drawCity(.24,550,'#272651',55,145,.32);
    // distant angular hills
    ctx.fillStyle='rgba(35,38,83,.57)';ctx.beginPath();ctx.moveTo(0,590);for(let x=0;x<=w+70;x+=70){ctx.lineTo(x,480+Math.sin((x+camera*.08)*.009)*32+Math.cos(x*.023)*12)}ctx.lineTo(w,640);ctx.lineTo(0,640);ctx.fill();
  }
  function drawCity(parallax,base,color,width,height,alpha){ctx.globalAlpha=alpha;ctx.fillStyle=color;let offset=(camera*parallax)%width;for(let x=-width;x<view.w+width;x+=width){let idx=Math.floor((x+offset+camera*parallax)/width);let bh=height+((idx*37%83+83)%83);let bx=x-offset;ctx.fillRect(bx,base-bh,width-5,bh);ctx.fillStyle='rgba(255,199,164,.32)';for(let yy=base-bh+14;yy<base-9;yy+=20)for(let xx=bx+10;xx<bx+width-10;xx+=17)if((Math.floor(xx+yy+idx)%3)!==0)ctx.fillRect(xx,yy,3,5);ctx.fillStyle=color}ctx.globalAlpha=1}
  function drawTrack(){
    // distant illuminated ribbon on the ground
    ctx.fillStyle='#25214d';ctx.fillRect(0,GROUND,view.w,120);
    for(let x=Math.floor(camera/64)*64;x<camera+view.w+64;x+=64){const sx=x-camera;const inGap=gaps.some(g=>x>=g[0]&&x<g[1]);if(!inGap){ctx.fillStyle=(Math.floor(x/64)%2===0)?'#36305e':'#302b57';ctx.fillRect(sx,GROUND,64,120);ctx.fillStyle='rgba(226,120,176,.25)';ctx.fillRect(sx,GROUND,64,3);ctx.fillStyle='rgba(17,21,53,.54)';for(let j=0;j<3;j++)ctx.fillRect(sx+12+j*20,GROUND+26,7,5)}}
    // neon underside trim
    ctx.fillStyle='#f4a0ac';for(let x=Math.floor(camera/130)*130;x<camera+view.w+130;x+=130)if(!gaps.some(g=>x>=g[0]&&x<g[1]))ctx.fillRect(x-camera,GROUND+4,65,2);
    for(const plat of platforms){const x=plat.x-camera;if(x+plat.w<0||x>view.w)continue;ctx.fillStyle='#282550';rr(ctx,x,plat.y,plat.w,28,5);ctx.fill();ctx.fillStyle='#a1f46b';rr(ctx,x,plat.y,plat.w,5,3);ctx.fill();ctx.fillStyle='rgba(250,177,142,.35)';for(let bx=x+12;bx<x+plat.w-8;bx+=23)ctx.fillRect(bx,plat.y+13,10,3);}
    for(const sx of springs){let x=sx-camera;if(x>-20&&x<view.w+20){ctx.fillStyle='#f9b25f';rr(ctx,x-14,GROUND-12,28,12,4);ctx.fill();ctx.strokeStyle='#fff0b0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-9,GROUND-13);ctx.lineTo(x-5,GROUND-20);ctx.lineTo(x,GROUND-13);ctx.lineTo(x+5,GROUND-20);ctx.lineTo(x+9,GROUND-13);ctx.stroke()}}
  }
  function drawRing(r,t){const x=r.x-camera,y=r.y;if(x < -30||x>view.w+30)return;const pulse=.85+Math.sin(t*5+r.x)*.15;ctx.save();ctx.translate(x,y);ctx.scale(pulse,1);ctx.shadowBlur=14;ctx.shadowColor='#d6ff78';ctx.strokeStyle='#e3ff9a';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,9,13,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(-1,-1,4,8,-.25,0,Math.PI*2);ctx.stroke();ctx.restore()}
  function drawEnemy(e,t){if(e.dead)return;const x=e.x-camera,y=GROUND-22+Math.sin(t*5+e.x)*2;if(x < -40||x>view.w+40)return;ctx.save();ctx.translate(x,y);ctx.shadowBlur=12;ctx.shadowColor='#ff916c';ctx.fillStyle='#f07f71';ctx.beginPath();ctx.ellipse(0,1,18,15,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#f9bb75';ctx.beginPath();ctx.ellipse(2,5,10,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#241f4b';ctx.beginPath();ctx.arc(-5,-3,2,0,Math.PI*2);ctx.arc(5,-3,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f7f6ff';rr(ctx,-16,11,13,6,3);ctx.fill();rr(ctx,4,11,13,6,3);ctx.fill();ctx.restore()}
  function drawPlayer(t){if(!player)return;const p=player,x=p.x-camera,y=p.y;ctx.save();ctx.translate(x,y-24);if(p.invuln&&Math.floor(t*13)%2===0)ctx.globalAlpha=.4;const rolling=!p.onGround||p.boosting; if(p.boosting){ctx.globalAlpha*=.28;for(let i=1;i<=4;i++){ctx.fillStyle=i%2?'#b8ff6a':'#76eaff';ctx.beginPath();ctx.ellipse(-p.facing*i*11,2,19-i*2,14-i,0,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=p.invuln&&Math.floor(t*13)%2===0?.4:1}
    ctx.rotate(rolling?Math.sin(p.anim*2)*.3:0);
    // speed scarf
    if(p.boosting){ctx.fillStyle='#a8f771';ctx.beginPath();ctx.moveTo(-p.facing*6,-4);ctx.lineTo(-p.facing*32,-13+Math.sin(t*18)*5);ctx.lineTo(-p.facing*24,2);ctx.closePath();ctx.fill()}
    // legs and bright trainers
    const run=Math.sin(p.anim*2)*5;ctx.strokeStyle='#fff0d4';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,12);ctx.lineTo(-8+run,20);ctx.stroke();ctx.beginPath();ctx.moveTo(6,12);ctx.lineTo(8-run,20);ctx.stroke();ctx.fillStyle='#ff8d72';rr(ctx,-19+run,17,20,9,4);ctx.fill();rr(ctx,2-run,17,20,9,4);ctx.fill();ctx.fillStyle='#fff1db';ctx.fillRect(-16+run,18,12,2);ctx.fillRect(5-run,18,12,2);
    // body
    ctx.fillStyle='#d5ff78';ctx.beginPath();ctx.ellipse(0,3,15,19,-.12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0d4';ctx.beginPath();ctx.ellipse(4,8,8,9,0,0,Math.PI*2);ctx.fill();
    // swept-back quills
    ctx.fillStyle='#a9ef72';ctx.beginPath();ctx.moveTo(-9,-7);ctx.lineTo(-25,-20);ctx.lineTo(-9,-17);ctx.lineTo(-21,-31);ctx.lineTo(-1,-21);ctx.lineTo(8,-18);ctx.lineTo(11,-4);ctx.closePath();ctx.fill();
    // face and eye
    ctx.fillStyle='#d5ff78';ctx.beginPath();ctx.ellipse(8,-7,14,13,-.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(12,-11,5,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#25234e';ctx.beginPath();ctx.ellipse(14,-10,2,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff0d4';ctx.beginPath();ctx.ellipse(19,-4,7,4,.1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#30244c';ctx.beginPath();ctx.arc(21,-5,1.3,0,Math.PI*2);ctx.fill();
    // small arms
    ctx.strokeStyle='#d5ff78';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-6,1);ctx.lineTo(-14,7+run*.2);ctx.stroke();ctx.fillStyle='#fff0d4';ctx.beginPath();ctx.arc(-15,8+run*.2,4,0,Math.PI*2);ctx.fill();
    ctx.restore();}
  function drawParticles(){for(const q of particles){ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x-camera,q.y,q.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  function draw(time){const t=time/1000;ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground();drawTrack();for(const r of rings)if(!r.got)drawRing(r,t);for(const e of enemies)drawEnemy(e,t);drawPlayer(t);drawParticles();ctx.restore();}
  function frame(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);draw(now);requestAnimationFrame(frame)}
  fresh();requestAnimationFrame(frame);
})();
