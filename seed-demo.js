// Demo data: node seed-demo.js  (products can be deleted from admin panel)
const db=require('./db'),fs=require('fs');
const end=new Date(Date.now()+864e5*2).toISOString();
const shapes={
 bottle:'<rect x="170" y="90" width="60" height="40" rx="8" fill="#2a1f2d"/><rect x="130" y="130" width="140" height="220" rx="30" fill="url(#g)"/><rect x="150" y="200" width="100" height="70" rx="8" fill="#fff" opacity=".85"/>',
 jar:'<rect x="110" y="150" width="180" height="40" rx="12" fill="#2a1f2d"/><rect x="100" y="190" width="200" height="130" rx="30" fill="url(#g)"/><rect x="140" y="230" width="120" height="50" rx="8" fill="#fff" opacity=".85"/>',
 lip:'<rect x="165" y="80" width="70" height="120" rx="10" fill="url(#g)"/><rect x="150" y="200" width="100" height="140" rx="10" fill="#2a1f2d"/><rect x="150" y="250" width="100" height="6" fill="#e8b4bc"/>',
 tube:'<path d="M150 90h100l20 250H130z" fill="url(#g)"/><rect x="140" y="70" width="120" height="30" rx="8" fill="#2a1f2d"/><rect x="160" y="200" width="80" height="50" rx="8" fill="#fff" opacity=".85"/>',
 perf:'<rect x="180" y="70" width="40" height="40" fill="#2a1f2d"/><rect x="170" y="110" width="60" height="30" fill="#e8b4bc"/><rect x="110" y="140" width="180" height="200" rx="24" fill="url(#g)" opacity=".92"/><rect x="150" y="210" width="100" height="60" rx="6" fill="#fff" opacity=".85"/>'};
const img=(slug,shape,c1,c2,label)=>{const f=`public/uploads/demo-${slug}.svg`;
 fs.writeFileSync(f,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><radialGradient id="b" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c1}" stop-opacity=".35"/></radialGradient></defs><rect width="400" height="400" fill="url(#b)"/><ellipse cx="200" cy="350" rx="110" ry="14" fill="#0002"/>${shapes[shape]}<text x="200" y="250" text-anchor="middle" font-family="Georgia,serif" font-size="14" letter-spacing="3" fill="#2a1f2d">${label}</text></svg>`);return '/uploads/demo-'+slug+'.svg'};
const cat=s=>db.prepare('SELECT id FROM categories WHERE slug=?').get(s).id;
const P=[['سرم ویتامین C روشن‌کننده','vitamin-c-serum','سرم روشن‌کننده و ضدلک','سرم ویتامین C با غلظت ۱۵٪ برای روشن‌کردن پوست و کاهش لک.\nنحوه مصرف: شب‌ها پس از شستشوی صورت چند قطره روی پوست بزنید.',1450000,20,'Velora Lab','skincare',1,1,1,'bottle','#f6c9a0','#e39a5a','VITAMIN C'],
['کرم آبرسان هیالورونیک','hyaluronic-cream','آبرسانی ۴۸ ساعته','کرم آبرسان با هیالورونیک اسید مناسب انواع پوست.',980000,0,'Velora Lab','skincare',1,0,0,'jar','#bfe3ee','#7fb8d0','HYALURONIC'],
['رژلب مایع مات','matte-liquid-lipstick','ماندگاری بالا، بدون خشکی','رژلب مایع مات با ماندگاری ۱۲ ساعته.',520000,15,'Rose Noir','makeup',1,1,1,'lip','#e0607e','#a3294a','MATTE'],
['کرم پودر مات','matte-foundation','پوشش کامل و طبیعی','کرم پودر با پوشش بالا و پایه آب.',1190000,10,'Rose Noir','makeup',0,1,0,'bottle','#f2d3b8','#d9a782','FOUNDATION'],
['ریمل حجم‌دهنده','volume-mascara','حجم و بلندی مژه','ریمل ضدآب با فرمول مراقب مژه.',430000,0,'Lumi','eyes',1,0,0,'tube','#555','#111','MASCARA'],
['شامپو ترمیم‌کننده','repair-shampoo','مخصوص موی آسیب‌دیده','شامپو بدون سولفات برای ترمیم موهای رنگ‌شده.',610000,25,'Silk Veil','hair',0,1,1,'tube','#d7c4ee','#9b7bc9','REPAIR'],
['ادوپرفیوم زنانه ولورا','velora-edp','رایحه گلی و چوبی','عطر اختصاصی VELORA، ۱۰۰ میلی‌لیتر.',3200000,12,'VELORA','perfume',1,1,0,'perf','#f4c6d0','#c77d90','VELORA'],
['ضدآفتاب SPF50','sunscreen-spf50','محافظت بالا، بدون چربی','ضدآفتاب بی‌رنگ SPF50 مناسب پوست چرب.',720000,18,'Velora Lab','skincare',0,1,1,'tube','#ffe9a8','#f0bd45','SPF 50']];
const ins=db.prepare('INSERT OR IGNORE INTO products(name,slug,brief,description,price,discount,brand,category_id,featured,daily_deal,deal_ends,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
P.forEach(p=>ins.run(p[0],p[1],p[2],p[3],p[4],p[5],p[6],cat(p[7]),p[8],p[9],p[9]?end:'',img(p[1],p[11],p[12],p[13],p[14])));
console.log('demo seeded');
