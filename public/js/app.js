(function(){
const FA=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const csrf=document.querySelector('meta[name=csrf]')?.content||'';
// theme
$('#theme')?.addEventListener('click',()=>{const d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;localStorage.setItem('theme',n)});
// scroll progress + header
const pg=document.createElement('div');pg.id='prog';document.body.prepend(pg);
addEventListener('scroll',()=>{const h=document.documentElement;pg.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';$('.sticky-buy')?.classList.toggle('on',h.scrollTop>600)},{passive:true});
// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
$$('.rv,.sec,.pc,.cat,.trust div,.testi div').forEach((el,i)=>{if(!el.classList.contains('rv'))el.classList.add('rv');el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
// counters
$$('[data-count]').forEach(el=>{const t=+el.dataset.count;new IntersectionObserver((es,o)=>{if(es[0].isIntersecting){o.disconnect();let s=null;const f=ts=>{s=s||ts;const p=Math.min(1,(ts-s)/1600);el.textContent=FA(Math.round(t*p).toLocaleString('en'));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}}).observe(el)});
// add to cart (+ fly animation)
const CHECK='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const bump=n=>$$('.cnt').forEach(c=>{c.textContent=FA(n);c.animate([{transform:'scale(1.9)'},{transform:'scale(1)'}],{duration:450})});
$$('.addcart').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();
 const b=f.querySelector('button');
 const r=await fetch('/cart/add',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify({id:f.id.value,qty:f.qty?f.qty.value:1,ajax:1})});
 if(!r.ok)return;const j=await r.json();
 const tgt=$('.acts a[href="/cart"]'),s=b.getBoundingClientRect();
 if(tgt){const t=tgt.getBoundingClientRect(),d=document.createElement('i');d.className='fly';d.style.left=(s.left+s.width/2)+'px';d.style.top=s.top+'px';document.body.appendChild(d);
  d.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${t.left-s.left-s.width/2+20}px,${t.top-s.top}px) scale(.3)`,opacity:.4}],{duration:700,easing:'cubic-bezier(.5,-.3,.7,.6)'}).onfinish=()=>{d.remove();bump(j.count)}}else bump(j.count);
 const old=b.innerHTML;b.classList.add('added');b.innerHTML=CHECK+' اضافه شد';setTimeout(()=>{b.classList.remove('added');b.innerHTML=old},1400);}));
// remove from cart (animated)
$$('.rmform').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const tr=f.closest('tr');tr.classList.add('gone');
 const r=await fetch('/cart/remove',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify({id:f.id.value,ajax:1})});
 if(r.ok){const j=await r.json();bump(j.count);setTimeout(()=>location.reload(),420)}else tr.classList.remove('gone')}));
// countdown
$$('[data-end]').forEach(el=>{const end=new Date(el.dataset.end),p=n=>FA(String(n).padStart(2,'0'));const t=()=>{let s=Math.max(0,Math.floor((end-Date.now())/1000));el.textContent=p(Math.floor(s/3600))+':'+p(Math.floor(s%3600/60))+':'+p(s%60)};t();setInterval(t,1000)});
// tilt on cards
if(matchMedia('(hover:hover)').matches)$$('.pc,.cat').forEach(c=>{c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform=`perspective(700px) rotateY(${x*7}deg) rotateX(${-y*7}deg) translateY(-8px)`});c.addEventListener('mouseleave',()=>c.style.transform='')});
// product page
$$('.thumbs img').forEach(t=>t.addEventListener('click',()=>{$('.gal .big img').src=t.src;$$('.thumbs img').forEach(x=>x.classList.remove('on'));t.classList.add('on')}));
const big=$('.gal .big');if(big&&$('img',big)){big.addEventListener('mousemove',e=>{const r=big.getBoundingClientRect(),i=$('img',big);i.style.transformOrigin=((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%';i.style.transform='scale(1.9)'});big.addEventListener('mouseleave',()=>$('img',big).style.transform='')}
$$('.tabs nav button').forEach(b=>b.addEventListener('click',()=>{$$('.tabs nav button,.pane').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.t).classList.add('on')}));
$$('.qty').forEach(q=>{const i=$('input',q);$$('button',q).forEach((b,k)=>b.addEventListener('click',()=>{i.value=Math.max(1,Math.min(+i.max||50,+i.value+(k?-1:1)))}))});
// OTP boxes
const ob=$$('.otpbox input');if(ob.length){const hid=$('#code');const sync=()=>hid.value=ob.map(x=>x.value).join('');
 ob.forEach((x,i)=>{x.addEventListener('input',()=>{x.value=x.value.replace(/\D/g,'').slice(-1);sync();if(x.value&&ob[i+1])ob[i+1].focus();if(hid.value.length===ob.length)x.form.requestSubmit()});
 x.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!x.value&&ob[i-1])ob[i-1].focus()});
 x.addEventListener('paste',e=>{const d=(e.clipboardData.getData('text')||'').replace(/\D/g,'');if(d){e.preventDefault();ob.forEach((o,k)=>o.value=d[k]||'');sync();if(d.length>=ob.length)x.form.requestSubmit()}})});ob[0].focus();
 const rs=$('#resend');if(rs){let s=60;const t=setInterval(()=>{s--;rs.textContent=s>0?'ارسال مجدد تا '+FA(s)+' ثانیه':'';if(s<=0){clearInterval(t);rs.innerHTML='<a href="/login" style="color:var(--gold)">ارسال مجدد کد</a>'}},1000)}}
// particles
const pc=$('.authart');if(pc)for(let i=0;i<22;i++){const p=document.createElement('i');p.className='pt';const s=4+Math.random()*10;p.style.cssText=`width:${s}px;height:${s}px;right:${Math.random()*100}%;animation-duration:${8+Math.random()*14}s;animation-delay:-${Math.random()*20}s`;pc.appendChild(p)}
// map + address book
const m=$('#map');if(m&&window.L){const la=$('#lat'),ln=$('#lng');const map=L.map('map').setView([35.7219,51.415],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
 let mk=null;const set=(c,z)=>{const p=Array.isArray(c)?c:[c.lat,c.lng];if(mk)mk.setLatLng(p);else mk=L.marker(p).addTo(map);la.value=(+p[0]).toFixed(6);ln.value=(+p[1]).toFixed(6);if(z)map.setView(p,z)};
 const clr=()=>{if(mk){map.removeLayer(mk);mk=null}la.value=ln.value='';map.setView([35.7219,51.415],11)};
 map.on('click',e=>set(e.latlng));
 $('#locate')?.addEventListener('click',()=>navigator.geolocation&&navigator.geolocation.getCurrentPosition(g=>set([g.coords.latitude,g.coords.longitude],16)));
 const form=$('#aform'),open=(d)=>{form.hidden=false;form.classList.remove('in');void form.offsetWidth;form.classList.add('in');$('#atitle').textContent=d.id?'ویرایش آدرس':'آدرس جدید';$('#aid').value=d.id||'';$('#atl').value=d.title||'';$('#aad').value=d.address||'';$('#arc').value=d.receiver||$('#arc').defaultValue;$('#arp').value=d.receiver_phone||$('#arp').defaultValue;$('#apv').value=d.province||'';$('#act').value=d.city||'';$('#apc').value=d.postal_code||'';
  $$('#ttl button').forEach(b=>b.classList.toggle('on',b.dataset.v===d.title));
  setTimeout(()=>{map.invalidateSize();d.lat&&d.lng?set([+d.lat,+d.lng],15):clr()},60);form.scrollIntoView({behavior:'smooth',block:'nearest'})};
 $('#addnew')?.addEventListener('click',()=>open({}));
 $$('.ed').forEach(b=>b.addEventListener('click',()=>open({...b.dataset})));
 $('#acancel')?.addEventListener('click',()=>form.hidden=true);
 $$('#ttl button').forEach(b=>b.addEventListener('click',()=>{$('#atl').value=b.dataset.v;$$('#ttl button').forEach(x=>x.classList.toggle('on',x===b))}));
 if(!$('.ad'))open({});}
// checkout address picker
$$('.apick').forEach(b=>b.addEventListener('click',()=>{const t=$('#coaddr');t.value=b.dataset.address;const q=(i,v)=>{const e=$(i);if(e&&v!=null)e.value=v};q('#copv',b.dataset.province);q('#coct',b.dataset.city);q('#copc',b.dataset.postal);if(b.dataset.name)q('[name=name]',b.dataset.name);if(b.dataset.phone)q('[name=phone]',b.dataset.phone);t.animate([{background:'var(--soft)'},{background:'var(--card)'}],{duration:700});$$('.apick').forEach(x=>x.classList.toggle('on',x===b))}));
// admin: confirm
$$('form[data-confirm]').forEach(f=>f.addEventListener('submit',e=>{if(!confirm(f.dataset.confirm))e.preventDefault()}));
})();
// extra animation helpers
(function(){
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
// ripple
document.addEventListener('click',e=>{const b=e.target.closest('.btn,.filters a,.tabs nav button');if(!b)return;const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),i=document.createElement('i');i.className='rip';i.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;if(getComputedStyle(b).position==='static')b.style.position='relative';b.style.overflow='hidden';b.appendChild(i);setTimeout(()=>i.remove(),650)});
if(matchMedia('(hover:hover)').matches){
 // cursor glow
 const g=document.createElement('div');g.id='cg';document.body.appendChild(g);addEventListener('mousemove',e=>{g.style.transform=`translate(${e.clientX}px,${e.clientY}px)`},{passive:true});
 // magnetic buttons
 $$('.btn.lg,.hbig .btn').forEach(b=>{b.addEventListener('mousemove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)/16}px,${(e.clientY-r.top-r.height/2)/10}px)`});b.addEventListener('mouseleave',()=>b.style.transform='')});
 // hero parallax
 const h=document.querySelector('.hbig');if(h)h.addEventListener('mousemove',e=>{const r=h.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;$$('.blob',h).forEach((b,i)=>b.style.translate=`${x*(40+i*25)}px ${y*(40+i*25)}px`);const o=h.querySelector('.orbit');if(o)o.style.translate=`${-x*30}px ${-y*30}px`});
}
// scroll parallax for blobs
addEventListener('scroll',()=>{const y=scrollY;$$('.hbig .orbit').forEach(o=>o.style.marginTop=(-150+y*.08)+'px')},{passive:true});
// typewriter-ish stagger of hero h1 skipped to keep text intact
})();
(function(){const f=document.getElementById('nlf');if(!f)return;const m=document.getElementById('nlm'),i=f.email;
f.addEventListener('submit',e=>{e.preventDefault();const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim());
 if(!ok){f.classList.remove('bad');void f.offsetWidth;f.classList.add('bad');m.textContent='لطفاً یک ایمیل معتبر وارد کنید.';m.className='nl-m err2';return}
 f.classList.remove('bad');f.classList.add('done');i.disabled=true;f.querySelector('button').innerHTML='✓ ثبت شد';m.textContent='خوش آمدید! به‌زودی برایتان تخفیف‌های ویژه می‌فرستیم.';m.className='nl-m ok2'})})();

(function(){document.querySelectorAll('.pw .eye').forEach(b=>b.addEventListener('click',()=>{const i=b.parentNode.querySelector('input');i.type=i.type==='password'?'text':'password';b.classList.toggle('on')}));
const n=document.getElementById('np'),n2=document.getElementById('np2');if(!n)return;
const upd=()=>{const v=n.value;let s=0;if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Za-z]/.test(v)&&/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;const t=['','ضعیف','متوسط','خوب','قوی','عالی'][v?s+ (v.length>=6?0:0):0]||'';
 const m=document.getElementById('mt');m.style.width=(v?Math.max(1,s)*25:0)+'%';m.style.background=['','#e0245e','#f5a623','#2563eb','#27ae60'][Math.max(1,s)];document.getElementById('mtx').textContent=v?['','ضعیف','متوسط','خوب','قوی'][Math.max(1,s)]:'';
 document.getElementById('mm').textContent=n2.value&&n2.value!==v?'تکرار رمز یکسان نیست':''};
n.addEventListener('input',upd);n2.addEventListener('input',upd)})();
// horizontal rows: arrows + drag + overflow detect
document.querySelectorAll('.hscroll').forEach(el=>{
  const w=document.createElement('div');w.className='hs-w';el.parentNode.insertBefore(w,el);w.appendChild(el);
  const mk=(c,t)=>{const b=document.createElement('button');b.type='button';b.className='hs-b '+c;b.setAttribute('aria-label',t);b.innerHTML=c==='nx'?'›':'‹';w.appendChild(b);return b};
  const nx=mk('nx','بعدی'),pv=mk('pv','قبلی');
  const step=()=>Math.max(240,el.clientWidth*.8);
  const upd=()=>{const max=el.scrollWidth-el.clientWidth-2,x=Math.abs(el.scrollLeft);
    w.classList.toggle('ov',max>4);pv.classList.toggle('off',x<=2);nx.classList.toggle('off',x>=max)};
  // RTL: scrollLeft is negative; "next" = further left (negative)
  const dir=getComputedStyle(el).direction==='rtl'?-1:1;
  nx.onclick=()=>el.scrollBy({left:dir*step(),behavior:'smooth'});
  pv.onclick=()=>el.scrollBy({left:-dir*step(),behavior:'smooth'});
  el.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);setTimeout(upd,300);setTimeout(upd,1500);
  let d=0,sx=0,sl=0,mv=0;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;d=1;mv=0;sx=e.clientX;sl=el.scrollLeft;});
  addEventListener('pointermove',e=>{if(!d)return;const dx=e.clientX-sx;if(Math.abs(dx)>5){mv=1;el.classList.add('drag')}if(mv)el.scrollLeft=sl-dx;});
  addEventListener('pointerup',()=>{d=0;setTimeout(()=>el.classList.remove('drag'),0)});
  el.addEventListener('click',e=>{if(mv){e.preventDefault();e.stopPropagation();mv=0}},true);
  // auto-scroll: slow drift, pauses on hover/touch/drag, loops back at the end
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let paused=false,acc=0,last=0,vis=true;
  ['mouseenter','pointerdown','touchstart','focusin'].forEach(ev=>el.addEventListener(ev,()=>paused=true,{passive:true}));
  ['mouseleave','pointerup','touchend','touchcancel','focusout'].forEach(ev=>el.addEventListener(ev,()=>setTimeout(()=>paused=false,1500),{passive:true}));
  if('IntersectionObserver' in window)new IntersectionObserver(es=>vis=es[0].isIntersecting).observe(el);
  const tick=t=>{requestAnimationFrame(tick);if(!last)last=t;const dt=Math.min(64,t-last);last=t;
    const max=el.scrollWidth-el.clientWidth-2;if(max<=4||paused||!vis||document.hidden||el.classList.contains('drag'))return;
    acc+=dt*0.035;if(acc<1)return;const px=Math.floor(acc);acc-=px;
    const x=Math.abs(el.scrollLeft);
    if(x>=max-1){paused=true;setTimeout(()=>{el.scrollTo({left:0,behavior:'smooth'});setTimeout(()=>paused=false,1500)},1200);return}
    el.style.scrollSnapType='none';el.scrollLeft+=dir*px};
  requestAnimationFrame(tick);
});
