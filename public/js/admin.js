(function(){
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
$$('#theme').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;localStorage.setItem('theme',n)}));
$$('form[data-confirm]').forEach(f=>f.addEventListener('submit',e=>{if(!confirm(f.dataset.confirm))e.preventDefault()}));
// live filter for tables: <input data-filter="#tbl"> + selects data-fcol="attr"
const rows=()=>$$('#tbl tbody tr[data-s]');
const apply=()=>{const q=($('[data-filter]')?.value||'').trim().toLowerCase();const sels=$$('[data-fattr]');let n=0;
 rows().forEach(r=>{let ok=!q||r.dataset.s.toLowerCase().includes(q);sels.forEach(s=>{if(s.value&&r.dataset[s.dataset.fattr]!==s.value)ok=false});r.style.display=ok?'':'none';if(ok)n++});
 const c=$('#count');if(c)c.textContent=n.toLocaleString('fa-IR');const e=$('#noRes');if(e)e.style.display=n?'none':'block'};
$$('[data-filter],[data-fattr]').forEach(i=>i.addEventListener('input',apply));
// tabs
$$('.tabs2').forEach(t=>{const key='tab:'+location.pathname;const go=id=>{$$('button',t).forEach(b=>b.classList.toggle('on',b.dataset.tab===id));$$('.tp').forEach(p=>p.classList.toggle('on',p.id===id));try{sessionStorage.setItem(key,id)}catch(e){}};
 $$('button',t).forEach(b=>b.addEventListener('click',()=>go(b.dataset.tab)));let s;try{s=sessionStorage.getItem(key)}catch(e){}go(s&&$('#'+s)?s:$$('button',t)[0].dataset.tab)});
// show tab containing invalid field (hidden required inputs block submit silently)
$$('form').forEach(f=>f.addEventListener('invalid',e=>{const tp=e.target.closest('.tp');if(tp&&!tp.classList.contains('on')){const b=$('.tabs2 button[data-tab="'+tp.id+'"]');if(b)b.click();setTimeout(()=>e.target.focus(),50)}},true));
// image preview / drop
$$('.drop').forEach(d=>{const i=$('input[type=file]',d);const show=f=>{if(!f||!f[0])return;const u=URL.createObjectURL(f[0]);let im=$('img.pv',d);if(!im){im=document.createElement('img');im.className='pv';d.prepend(im)}im.src=u;const t=$('.dt',d);if(t)t.textContent=f[0].name};
 i.addEventListener('change',()=>show(i.files));['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('over')}));['dragleave','drop'].forEach(ev=>d.addEventListener(ev,()=>d.classList.remove('over')));
 d.addEventListener('drop',e=>{e.preventDefault();i.files=e.dataTransfer.files;show(i.files)})});
// price preview
const pr=$('[name=price]'),dc=$('[name=discount]'),pv=$('#pp');if(pr&&dc&&pv){const u=()=>{const p=+pr.value||0,d=Math.min(95,+dc.value||0);pv.innerHTML='<span>قیمت نهایی برای مشتری</span><b>'+Math.round(p*(100-d)/100).toLocaleString('fa-IR')+' تومان</b>'};pr.addEventListener('input',u);dc.addEventListener('input',u);u()}
$$('[data-cc]').forEach(b=>b.addEventListener('click',e=>{if(!confirm(b.dataset.cc))e.preventDefault()}));
// prevent double submit
$$('form').forEach(f=>f.addEventListener('submit',e=>{if(e.defaultPrevented)return;const b=e.submitter||f.querySelector('button.btn:not(.o)');if(b&&f.method==='post'){setTimeout(()=>{b.disabled=true;b.style.opacity=.6},0)}}));

// product category + subcategory
(()=>{const m=document.getElementById('catMain'),s=document.getElementById('catSub'),v=document.getElementById('catVal');if(!m||!s||!v)return;
const sync=(first)=>{let any=false;[...s.options].forEach(o=>{if(!o.value)return;const ok=o.dataset.p===m.value;o.hidden=!ok;o.disabled=!ok;if(ok)any=true});
 if(first&&s.dataset.sel&&[...s.options].some(o=>o.value===s.dataset.sel&&!o.hidden))s.value=s.dataset.sel;else if(!first)s.value='';
 s.disabled=!any;v.value=s.value||m.value||''};
m.addEventListener('change',()=>sync(false));s.addEventListener('change',()=>{v.value=s.value||m.value||''});sync(true)})();

// remaining time in products table
$$('[data-left]').forEach(el=>{const e=new Date(el.dataset.left),F=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);const u=()=>{const s=Math.max(0,Math.floor((e-Date.now())/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);el.textContent=(d?F(d)+' روز و ':'')+F(h)+' ساعت'+(d?'':' و '+F(m)+' دقیقه')+' مانده'};u();setInterval(u,30000)});
// Jalali deal-end picker
const jalaliInit=P=>{const G=id=>document.getElementById(P+id);const iso=G('dealIso');if(!iso)return;
const div=(a,b)=>~~(a/b),mod=(a,b)=>a-~~(a/b)*b;
const brk=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
const jalCal=jy=>{let bl=brk.length,gy=jy+621,leapJ=-14,jp=brk[0],jm,jump,leap,n,i;for(i=1;i<bl;i++){jm=brk[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ++;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150,march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}};
const g2d=(gy,gm,gd)=>{let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;return d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752};
const d2g=jdn=>{let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308,gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1;return{gy:div(j,1461)-100100+div(8-gm,6),gm,gd}};
const j2d=(jy,jm,jd)=>{const r=jalCal(jy);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1};
const d2j=jdn=>{const g=d2g(jdn).gy;let jy=g-621,r=jalCal(jy),j1=g2d(g,3,r.march),k=jdn-j1,jm,jd;if(k>=0){if(k<=185){jm=1+div(k,31);jd=mod(k,31)+1;return{jy,jm,jd}}k-=186}else{jy--;k+=179;if(r.leap===1)k++}jm=7+div(k,30);jd=mod(k,30)+1;return{jy,jm,jd}};
const toJ=(y,m,d)=>d2j(g2d(y,m,d)),toG=(y,m,d)=>d2g(j2d(y,m,d));
const isLeap=y=>jalCal(y).leap===0,dim=(y,m)=>m<=6?31:m<=11?30:(isLeap(y)?30:29);
const FA=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const MN=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const jy=G('jy'),jm=G('jm'),jd=G('jdd'),jh=G('jh'),jmi=G('jmi');
const opt=(s,v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o)};
const now=toJ(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate());
opt(jy,'','—');for(let y=now.jy;y<=now.jy+3;y++)opt(jy,y,FA(y));
opt(jm,'','—');MN.forEach((n,i)=>opt(jm,i+1,n));
opt(jd,'','—');for(let i=1;i<=31;i++)opt(jd,i,FA(i));
opt(jh,'','—');for(let i=0;i<24;i++)opt(jh,i,FA(String(i).padStart(2,'0')));
opt(jmi,'','—');for(let i=0;i<60;i+=5)opt(jmi,i,FA(String(i).padStart(2,'0')));
const ensure=(sel,v,t)=>{if(![...sel.options].some(o=>+o.value===v&&o.value!==''))opt(sel,v,t)};
const fill=dt=>{const j=toJ(dt.getFullYear(),dt.getMonth()+1,dt.getDate());ensure(jy,j.jy,FA(j.jy));jy.value=j.jy;jm.value=j.jm;jd.value=j.jd;jh.value=dt.getHours();ensure(jmi,dt.getMinutes(),FA(String(dt.getMinutes()).padStart(2,'0')));jmi.value=dt.getMinutes()};
if(iso.value){const dt=new Date(iso.value);if(!isNaN(dt))fill(dt)}
const upd=()=>{if(jy.value&&jm.value){const mx=dim(+jy.value,+jm.value);[...jd.options].forEach(o=>{if(o.value)o.hidden=+o.value>mx});if(+jd.value>mx)jd.value=mx}
 if(!jy.value||!jm.value||!jd.value){iso.value='';return}
 const g=toG(+jy.value,+jm.value,+jd.value),dt=new Date(g.gy,g.gm-1,g.gd,+jh.value||0,+jmi.value||0,0);iso.value=isNaN(dt)?'':dt.toISOString()};
[jy,jm,jd,jh,jmi].forEach(s=>s.addEventListener('change',upd));
const rel=G('jrel');if(rel){const setRel=v=>{if(![...rel.options].some(o=>o.value===v))opt(rel,v,'تاریخ مشخص‌شده (در بخش دقیق)');rel.value=v};
 if(iso.value)setRel('c');
 rel.addEventListener('change',()=>{if(rel.value==='0'){[jy,jm,jd,jh,jmi].forEach(x=>x.value='');iso.value='';return}if(rel.value==='c')return;const dt=new Date(Date.now()+(+rel.value)*864e5);fill(dt);upd();iso.value=dt.toISOString()});
 [jy,jm,jd,jh,jmi].forEach(x=>x.addEventListener('change',()=>{if(iso.value)setRel('c');else rel.value='0'}))}
};jalaliInit('');jalaliInit('b');
(()=>{const dc=document.querySelector('[name=discount]'),bx=document.getElementById('dealbox');if(dc&&bx){const t=()=>{bx.style.display=(+dc.value>0)?'':'none'};dc.addEventListener('input',t);t()}})();
})();
// mobile drawer
(()=>{const b=document.getElementById('burger'),sc=document.getElementById('scrim'),d=document.body;if(!b)return;const t=v=>d.classList.toggle('navopen',v);
b.addEventListener('click',()=>t());sc.addEventListener('click',()=>t(false));document.querySelectorAll('.adm aside a').forEach(a=>a.addEventListener('click',()=>t(false)));
addEventListener('keydown',e=>{if(e.key==='Escape')t(false)})})();
