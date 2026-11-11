/* Fondo animado (líneas de metro con trenes, pulsos de geocerca y fragmentos de código), barra de estado y revelado al hacer scroll.
   Sin dependencias. Respeta prefers-reduced-motion, se pausa en pestañas ocultas y se puede apagar con el botón de la barra. */
(function(){
'use strict';
var doc=document, root=doc.documentElement;
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
function put(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var enabled=get('erl-bg')!=='off';

/* ---------- barra de estado ---------- */
var pad=function(n,l){n=String(Math.max(0,Math.round(n)));while(n.length<l)n='0'+n;return n};
var dEl=doc.querySelectorAll('[data-hud-date]');
if(dEl.length){var d=new Date();var s=pad(d.getDate(),2)+'.'+pad(d.getMonth()+1,2)+'.'+d.getFullYear();for(var i=0;i<dEl.length;i++)dEl[i].textContent=s}
var xEl=doc.querySelectorAll('[data-hud-x]'), yEl=doc.querySelectorAll('[data-hud-y]');
var px=0, py=0;
function paintXY(){for(var i=0;i<xEl.length;i++)xEl[i].textContent=pad(px,4);for(i=0;i<yEl.length;i++)yEl[i].textContent=pad(py,4)}

/* ---------- revelado ---------- */
(function(){
  if(reduce||!('IntersectionObserver' in window)) return;
  var els=doc.querySelectorAll('main > section, .cols > section, .cols > aside, .item, .svc, .pitem, .facts');
  if(!els.length) return;
  root.classList.add('js-rv');
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting||e.boundingClientRect.top<0){e.target.classList.add('in');io.unobserve(e.target)}
  })},{threshold:.06,rootMargin:'0px 0px -6% 0px'});
  els.forEach(function(el,i){el.classList.add('rv');el.style.transitionDelay=(i%3)*60+'ms';io.observe(el)});
  setTimeout(function(){els.forEach(function(el){el.classList.add('in')})},6000);
})();

/* ---------- atajo Enter ---------- */
var ent=doc.querySelector('a.enter[href]');
if(ent){doc.addEventListener('keydown',function(e){
  if(e.key!=='Enter'||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.defaultPrevented) return;
  var a=doc.activeElement; if(a&&a!==doc.body&&a!==root) return;
  location.href=ent.getAttribute('href');
})}

/* ---------- lienzo ---------- */
var cv=doc.createElement('canvas'); cv.id='bgfx'; cv.setAttribute('aria-hidden','true');
cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
doc.body.insertBefore(cv,doc.body.firstChild);
var ctx=cv.getContext('2d'); if(!ctx) return;
var W=0,H=0,dpr=1,small=false,pal=null,dark=false;
var routes=[],trains=[],pulses=[],snips=[],last=0,raf=0,tNext=0;
var SN=['d = 2R·asin(√h)','dist(a,b) ≤ r + accuracy','POST /api/v1/checkins → 201','@SpringBootApplication','status: ACCEPTED','mockLocation == false','token_version++','docker compose up -d','git push origin main','19.4326, -99.1332','WorkManager.enqueue(sync)','SELECT * FROM checkins','Flyway: V12__roles.sql','JWT · HS256','findByClientEventId(id)','@Transactional','200 OK · replay','reason: BORDERLINE_DISTANCE','caddy reverse-proxy :8080','fun capture() = CameraX'];

function readPal(){
  var cs=getComputedStyle(root), g=function(n){return cs.getPropertyValue(n).trim()||'#888'};
  var th=root.dataset.theme; dark=th?th==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  pal={lines:[g('--l-web'),g('--l-desk'),g('--l-data'),g('--l-emb'),g('--l-ai'),g('--l-infra')],ink:g('--ink'),muted:g('--muted'),bg:g('--bg')};
}
function rgba(hex,a){
  hex=hex.replace('#',''); if(hex.length===3)hex=hex.replace(/./g,'$&$&');
  var n=parseInt(hex,16); if(isNaN(n))return 'rgba(128,128,128,'+a+')';
  return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';
}

/* rutas octilineales: se definen en proporciones del lienzo */
function build(){
  var m=Math.min(W,H), D=0.11*m, defs=[
    {x:-0.02,y:0.16,mv:[['h',.30],['dd',D],['h',.32],['du',D*.8],['h',.5]]},
    {x:-0.02,y:0.46,mv:[['h',.18],['du',D*1.2],['h',.22],['dd',D*.9],['h',.22],['du',D*.6],['h',.5]]},
    {x:-0.02,y:0.78,mv:[['h',.38],['du',D*1.4],['h',.26],['dd',D*.7],['h',.5]]},
    {x:0.12,y:-0.02,mv:[['v',.22],['dd',D*.9],['v',.28],['dd',D*.6],['v',.7]]},
    {x:0.86,y:-0.02,mv:[['v',.30],['dd',-D*1.0],['v',.30],['dd',D*.8],['v',.7]]}
  ];
  routes=defs.map(function(r,i){
    var pts=[[r.x*W,r.y*H]], x=r.x*W, y=r.y*H;
    r.mv.forEach(function(s){
      var k=s[0],v=s[1];
      if(k==='h'){x+=v*W}
      else if(k==='v'){y+=v*H}
      else if(k==='dd'){x+=Math.abs(v);y+=v}   /* diagonal hacia abajo-derecha (v<0: arriba-izquierda) */
      else if(k==='du'){x+=Math.abs(v);y-=v}   /* diagonal hacia arriba-derecha */
      pts.push([x,y]);
    });
    var cum=[0],len=0;
    for(var j=1;j<pts.length;j++){len+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);cum.push(len)}
    return {pts:pts,cum:cum,len:len,c:i%pal.lines.length};
  });
  trains=[]; var per=small?1:2;
  routes.forEach(function(r,i){for(var k=0;k<per;k++)trains.push({r:r,d:Math.random()*r.len,v:(34+Math.random()*30)*(small?.8:1)})});
  snips=[]; var n=small?7:16;
  for(var i=0;i<n;i++)snips.push({t:SN[i%SN.length],x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*10,vy:-(4+Math.random()*8),s:11+Math.random()*4,p:Math.random()*6.28,r:Math.random()});
}
function at(r,d){
  d=Math.max(0,Math.min(r.len,d));
  for(var j=1;j<r.cum.length;j++){
    if(d<=r.cum[j]){var t=(d-r.cum[j-1])/((r.cum[j]-r.cum[j-1])||1);return [r.pts[j-1][0]+(r.pts[j][0]-r.pts[j-1][0])*t,r.pts[j-1][1]+(r.pts[j][1]-r.pts[j-1][1])*t]}
  }
  return r.pts[r.pts.length-1];
}
function size(){
  dpr=Math.min(window.devicePixelRatio||1,2); W=innerWidth; H=innerHeight; small=W<700;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  readPal(); build();
}

function draw(now,dt){
  ctx.clearRect(0,0,W,H);
  var la=dark?.14:.09;
  /* líneas y estaciones */
  routes.forEach(function(r){
    var col=pal.lines[r.c];
    ctx.lineWidth=small?5:7; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=rgba(col,la);
    ctx.beginPath(); r.pts.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])}); ctx.stroke();
    var step=small?260:230;
    for(var d=step*.6;d<r.len;d+=step){var p=at(r,d);ctx.beginPath();ctx.arc(p[0],p[1],small?4.5:6,0,6.283);ctx.fillStyle=rgba(pal.bg,.9);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=rgba(col,la*2.1);ctx.stroke()}
  });
  /* trenes */
  trains.forEach(function(t){
    var col=pal.lines[t.r.c];
    for(var k=0;k<14;k++){
      var a=at(t.r,t.d-k*5), b=at(t.r,t.d-(k+1)*5);
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]);
      ctx.lineWidth=small?4:5.5; ctx.lineCap='round'; ctx.strokeStyle=rgba(col,(dark?.55:.4)*(1-k/14)); ctx.stroke();
    }
    var h=at(t.r,t.d); ctx.beginPath(); ctx.arc(h[0],h[1],small?3.5:4.5,0,6.283); ctx.fillStyle=rgba(col,dark?.9:.7); ctx.fill();
  });
  /* pulsos de geocerca */
  for(var i=pulses.length-1;i>=0;i--){
    var p=pulses[i], k=(now-p.t0)/p.life;
    if(k>=1){pulses.splice(i,1);continue}
    if(k<0)continue;
    var e=1-Math.pow(1-k,2.2);
    ctx.beginPath(); ctx.arc(p.x,p.y,p.R*e,0,6.283); ctx.lineWidth=2; ctx.strokeStyle=rgba(pal.lines[p.c],(dark?.5:.34)*(1-k)); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x,p.y,p.R*.5*e,0,6.283); ctx.lineWidth=1; ctx.strokeStyle=rgba(pal.lines[p.c],(dark?.3:.2)*(1-k)); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,6.283); ctx.fillStyle=rgba(pal.lines[p.c],(dark?.7:.5)*(1-k*.6)); ctx.fill();
    if(p.label&&!small){ctx.font='11px "JetBrains Mono",monospace';ctx.fillStyle=rgba(pal.muted,.55*(1-k));ctx.fillText(p.label,p.x+9,p.y-8)}
  }
  /* fragmentos de código */
  snips.forEach(function(s){
    var dx=px-s.x, dy=py-s.y, near=Math.max(0,1-Math.hypot(dx,dy)/170);
    var a=(dark?.14:.1)*(.55+.45*Math.sin(now/2600+s.p))+near*.25;
    ctx.font=s.s+'px "JetBrains Mono",ui-monospace,monospace'; ctx.fillStyle=rgba(pal.ink,a); ctx.fillText(s.t,s.x,s.y);
  });
}
function spawn(x,y,now){
  if(pulses.length>6) pulses.shift();
  pulses.push({x:x,y:y,R:(small?70:110)+Math.random()*50,t0:now,life:2800+Math.random()*1200,c:(Math.random()*pal.lines.length)|0,label:Math.random()<.5?(19+Math.random()).toFixed(4)+', '+(-99-Math.random()).toFixed(4):null});
}
function frame(ts){
  raf=requestAnimationFrame(frame);
  if(doc.hidden) return;
  var dt=Math.min(.05,(ts-(last||ts))/1000); last=ts;
  trains.forEach(function(t){t.d+=t.v*dt; if(t.d>t.r.len+80)t.d=-40});
  snips.forEach(function(s){
    s.x+=s.vx*dt; s.y+=s.vy*dt;
    if(s.y<-20){s.y=H+20;s.x=Math.random()*W;s.t=SN[(Math.random()*SN.length)|0]}
    if(s.x<-260)s.x=W; if(s.x>W+20)s.x=-200;
  });
  if(ts>tNext){spawn(Math.random()*W,Math.random()*H,ts);tNext=ts+2600+Math.random()*2400}
  draw(ts,dt);
}
function start(){
  cancelAnimationFrame(raf);
  if(!enabled){ctx.clearRect(0,0,W,H);cv.style.display='none';return}
  cv.style.display='block';
  if(reduce){draw(0,0);return}
  last=0; raf=requestAnimationFrame(frame);
}

/* interacción */
var mv=false;
addEventListener('pointermove',function(e){px=e.clientX;py=e.clientY;if(!mv){mv=true;requestAnimationFrame(function(){mv=false;paintXY()})}},{passive:true});
addEventListener('pointerdown',function(e){if(enabled&&!reduce)spawn(e.clientX,e.clientY,performance.now())},{passive:true});
var rt; addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){size();start()},150)});
try{new MutationObserver(function(){readPal();if(reduce&&enabled)draw(0,0)}).observe(root,{attributes:true,attributeFilter:['data-theme']})}catch(e){}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){readPal();if(reduce&&enabled)draw(0,0)})}catch(e){}

/* botón de la barra */
var bt=doc.querySelectorAll('[data-hud-bg]');
function paintBtn(){for(var i=0;i<bt.length;i++)bt[i].setAttribute('aria-pressed',String(enabled))}
for(var i=0;i<bt.length;i++)bt[i].addEventListener('click',function(){enabled=!enabled;put('erl-bg',enabled?'on':'off');paintBtn();start()});
paintBtn();
size(); paintXY(); start();
})();
