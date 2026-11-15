const express = require('express'), session = require('express-session'), multer = require('multer'), bcrypt = require('bcryptjs');
const path = require('path'), crypto = require('crypto'), fs = require('fs');
const db = require('./db'); const {ic,stars,catIcon}=require('./icons');
const helmet = require('helmet'), rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000, PROD = process.env.NODE_ENV === 'production';
const SITE = process.env.SITE_URL || `http://localhost:${PORT}`;
// persistent random session secret
const secretFile = path.join(__dirname, '.session-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), {mode:0o600});
const SECRET = process.env.SESSION_SECRET || fs.readFileSync(secretFile,'utf8');
app.set('view engine','ejs'); app.set('views', path.join(__dirname,'views')); app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1);
app.use((req,res,next)=>{res.locals.nonce=crypto.randomBytes(16).toString('base64');next();});
app.use(helmet({
  contentSecurityPolicy:{useDefaults:false,directives:{
    defaultSrc:["'self'"],
    scriptSrc:["'self'",(req,res)=>`'nonce-${res.locals.nonce}'`,'https://unpkg.com'],
    styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com','https://unpkg.com'],
    fontSrc:["'self'",'https://fonts.gstatic.com'],
    imgSrc:["'self'",'data:','https://*.tile.openstreetmap.org','https://tile.openstreetmap.org','https://unpkg.com'],
    connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'self'"],formAction:["'self'"]}},
  crossOriginEmbedderPolicy:false, hsts:PROD, referrerPolicy:{policy:'strict-origin-when-cross-origin'}}));
app.use(express.urlencoded({extended:false,limit:'200kb'})); app.use(express.json({limit:'100kb'}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:PROD?'7d':0,setHeaders:(r,p)=>{if(p.includes('/uploads/'))r.setHeader('Content-Disposition','inline');r.setHeader('X-Content-Type-Options','nosniff')}}));
class SqlStore extends session.Store{
  get(sid,cb){try{const r=db.prepare('SELECT data,expires FROM sessions WHERE sid=?').get(sid);if(!r||r.expires<Date.now())return cb(null,null);cb(null,JSON.parse(r.data));}catch(e){cb(e)}}
  set(sid,sess,cb){try{const exp=sess.cookie&&sess.cookie.expires?new Date(sess.cookie.expires).getTime():Date.now()+30*864e5;db.prepare('INSERT OR REPLACE INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify(sess),exp);cb&&cb(null)}catch(e){cb&&cb(e)}}
  destroy(sid,cb){try{db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb&&cb(null)}catch(e){cb&&cb(e)}}
  touch(sid,sess,cb){this.set(sid,sess,cb)}
}
setInterval(()=>{try{db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())}catch(e){}},36e5).unref();
app.use(session({store:new SqlStore(),name:'velora.sid',secret:SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:PROD,maxAge:30*864e5}}));
// CSRF (token in session; accepted from header, query or body)
app.use((req,res,next)=>{
  if(!req.session.csrf) req.session.csrf=crypto.randomBytes(24).toString('hex'); res.locals.csrf=req.session.csrf;
  if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const t=req.get('x-csrf-token')||req.query._csrf||(req.body&&req.body._csrf)||'';
  const a=Buffer.from(String(t)),b=Buffer.from(req.session.csrf);
  if(a.length===b.length&&crypto.timingSafeEqual(a,b)) return next();
  res.status(403).send('نشست منقضی شده یا درخواست نامعتبر است. صفحه را رفرش کنید.');
});
const limiter=(max,min,msg)=>rateLimit({windowMs:min*60000,max,standardHeaders:true,legacyHeaders:false,handler:(req,res)=>res.status(429).send(msg||'تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.')});
app.use(limiter(600,1));
const audit=(req,action)=>db.prepare('INSERT INTO audit(who,action,ip) VALUES(?,?,?)').run(req.session.adminId?('admin#'+req.session.adminId):'-',action,req.ip);

const EXT=new Set(['.jpg','.jpeg','.png','.webp','.gif']);
const upload = multer({storage:multer.diskStorage({destination:'public/uploads',filename:(r,f,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(4).toString('hex')+path.extname(f.originalname).toLowerCase())}),
  limits:{fileSize:5e6,files:8},fileFilter:(r,f,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(f.mimetype)&&EXT.has(path.extname(f.originalname).toLowerCase()))});

const VER=Date.now().toString(36);
// ---- secret admin path (stored in DB, never linked from public site)
const adminPathRow=db.prepare("SELECT value FROM settings WHERE key='admin_path'").get();
const ADM='/'+(adminPathRow?adminPathRow.value:(()=>{const p='vl-'+crypto.randomBytes(9).toString('hex');db.prepare("INSERT INTO settings VALUES('admin_path',?)").run(p);return p})());
const getSettings=()=>Object.fromEntries(db.prepare('SELECT * FROM settings').all().map(r=>[r.key,r.value]));
const finalPrice=p=>Math.round(p.price*(100-(p.discount||0))/100);
const toFa=n=>Number(n).toLocaleString('fa-IR');
const slugify=s=>String(s).trim().toLowerCase().replace(/[^\w\u0600-\u06FF]+/g,'-').replace(/^-|-$/g,'')||crypto.randomBytes(3).toString('hex');
const normPhone=p=>{p=String(p||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g,'');if(p.startsWith('98'))p='0'+p.slice(2);if(p.length===10&&p[0]==='9')p='0'+p;return /^09\d{9}$/.test(p)?p:null};
const productsQ=(where='',args=[],order='created DESC',limit=100)=>db.prepare(`SELECT p.*,c.name cat_name,c.slug cat_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ${where} ORDER BY ${order} LIMIT ${limit}`).all(...args);

app.use((req,res,next)=>{
  const s=getSettings(); res.locals.ic=ic;res.locals.stars=stars;res.locals.catIcon=catIcon;delete s.admin_path;res.locals.smsHasKey=!!s.sms_key;delete s.sms_key;res.locals.ADM=ADM;res.locals.ST={pending_payment:['در انتظار پرداخت','warn'],paid:['پرداخت‌شده','ok'],shipped:['ارسال‌شده','info'],done:['تحویل‌شده','ok'],canceled:['لغوشده','bad']};res.locals.fd=d=>{try{return new Date(String(d).replace(' ','T')+'Z').toLocaleDateString('fa-IR')}catch(e){return d}};res.locals.S=s; res.locals.v=VER; res.locals.fp=finalPrice; res.locals.fa=toFa; res.locals.SITE=SITE;
  const allc=db.prepare('SELECT * FROM categories ORDER BY sort,id').all();res.locals.allcats=allc;
  res.locals.cats=allc.filter(c=>!c.parent_id).map(c=>Object.assign({},c,{subs:allc.filter(x=>x.parent_id===c.id)}));
  res.locals.user=req.session.userId?db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId):null;if(req.session.userId&&!res.locals.user)delete req.session.userId;
  res.locals.isAdmin=!!req.session.adminId; req.session.cart=req.session.cart||{};
  res.locals.cartCount=Object.values(req.session.cart).reduce((a,b)=>a+b,0);
  res.locals.meta={title:s.seo_title,desc:s.seo_desc,path:req.path,image:'/img/logo.svg',type:'website',ld:null};
  res.locals.flash=req.session.flash; delete req.session.flash; next();
});

// expire timed discounts
let lastExp=0;app.use((req,res,next)=>{const n=Date.now();if(n-lastExp>20000){lastExp=n;try{db.prepare("UPDATE products SET discount=0,daily_deal=0,deal_ends='' WHERE deal_ends<>'' AND deal_ends<?").run(new Date().toISOString())}catch(e){}}next()});
// ---------- storefront
app.get('/',(req,res)=>{
  res.render('home',{
    banners:db.prepare('SELECT * FROM banners WHERE active=1 ORDER BY sort,id').all(),
    deals:productsQ("AND daily_deal=1 AND discount>0 AND deal_ends>?",[new Date().toISOString()],'discount DESC',8),
    testi:db.prepare('SELECT * FROM testimonials WHERE active=1 ORDER BY sort,id').all(),
    best:productsQ('',[],'p.views DESC,p.id',8),
    ring:productsQ("AND p.image<>''",[],'p.featured DESC,p.created DESC',6),
    featured:productsQ('AND featured=1',[],'created DESC',8),
    latest:productsQ('',[],'created DESC',8)});
});
app.get('/shop',(req,res)=>{
  const q=(req.query.q||'').trim(), sort=req.query.sort; let where='',args=[];
  if(q){where+=' AND (p.name LIKE ? OR p.brand LIKE ? OR p.brief LIKE ?)';args.push(...Array(3).fill(`%${q}%`));}
  if(req.query.deals){where+=' AND p.discount>0';}
  const order={cheap:'price*(100-discount) ASC',exp:'price*(100-discount) DESC',off:'discount DESC'}[sort]||'p.created DESC';
  res.locals.meta.title=(q?`جستجوی ${q}`:'همه محصولات')+' | VELORA';
  res.render('shop',{title:q?`نتایج «${q}»`:req.query.deals?'تخفیف‌ها':'همه محصولات',products:productsQ(where,args,order),category:null,q,sort});
});
app.get('/category/:slug',(req,res)=>{
  const c=db.prepare('SELECT * FROM categories WHERE slug=?').get(req.params.slug); if(!c) return res.status(404).render('404');
  const order={cheap:'price*(100-discount) ASC',exp:'price*(100-discount) DESC',off:'discount DESC'}[req.query.sort]||'p.created DESC';
  res.locals.meta.title=`خرید ${c.name} | VELORA`; res.locals.meta.desc=`بهترین‌های ${c.name} با قیمت مناسب و ضمانت اصالت در VELORA`;
  res.render('shop',{title:c.name,products:productsQ(`AND category_id IN (SELECT ? UNION SELECT id FROM categories WHERE parent_id=?)`,[c.id,c.id],order),category:c,subs:db.prepare('SELECT * FROM categories WHERE parent_id=? ORDER BY sort,id').all(c.id),parent:c.parent_id?db.prepare('SELECT * FROM categories WHERE id=?').get(c.parent_id):null,q:'',sort:req.query.sort});
});
app.get('/product/:slug',(req,res)=>{
  const p=productsQ('AND p.slug=?',[req.params.slug],'1',1)[0]; if(!p) return res.status(404).render('404');
  db.prepare('UPDATE products SET views=views+1 WHERE id=?').run(p.id);
  const similar=productsQ('AND category_id=? AND p.id!=?',[p.category_id,p.id],'RANDOM()',4);
  const images=[p.image,...db.prepare('SELECT path FROM product_images WHERE product_id=? ORDER BY sort,id').all(p.id).map(x=>x.path)].filter(Boolean);
  const reviews=db.prepare('SELECT * FROM reviews WHERE product_id=? AND approved=1 ORDER BY id DESC').all(p.id);
  const avg=reviews.length?reviews.reduce((a,r)=>a+r.rating,0)/reviews.length:0;
  Object.assign(res.locals.meta,{title:`${p.name} | VELORA`,desc:p.brief||p.description.slice(0,150),image:p.image||'/img/logo.svg',type:'product',
    ld:{'@context':'https://schema.org','@type':'Product',name:p.name,image:images.map(x=>SITE+x),description:p.brief,brand:{'@type':'Brand',name:p.brand||'VELORA'},
      ...(reviews.length?{aggregateRating:{'@type':'AggregateRating',ratingValue:avg.toFixed(1),reviewCount:reviews.length}}:{}),
      offers:{'@type':'Offer',priceCurrency:'IRR',price:finalPrice(p)*10,availability:p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',url:SITE+req.path}}});
  res.render('product',{p,similar,images,reviews,avg});
});
app.post('/product/:slug/review',(req,res)=>{
  if(!req.session.userId){req.session.next='/product/'+req.params.slug;return res.redirect('/login');}
  const p=db.prepare('SELECT id FROM products WHERE slug=?').get(req.params.slug); if(!p) return res.status(404).render('404');
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  const r=Math.min(5,Math.max(1,+req.body.rating||5)), body=String(req.body.body||'').trim().slice(0,800); if(!body){return res.redirect('/product/'+req.params.slug);}
  if(db.prepare('SELECT 1 FROM reviews WHERE product_id=? AND user_id=?').get(p.id,u.id)){req.session.flash='شما قبلاً نظر داده‌اید';return res.redirect('/product/'+req.params.slug+'#reviews');}
  db.prepare('INSERT INTO reviews(product_id,user_id,name,rating,body) VALUES(?,?,?,?,?)').run(p.id,u.id,(u.first_name||'کاربر')+' '+(u.last_name?u.last_name[0]+'.':''),r,body);
  req.session.flash='نظر شما ثبت شد، ممنون';res.redirect('/product/'+req.params.slug+'#reviews');
});
app.get('/page/about',(req,res)=>res.render('about'));

// cart
const couponCalc=(req,sub)=>{const code=req.session.coupon;if(!code)return{off:0,code:''};
  const c=db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').get(code);
  if(!c||(c.expires&&new Date(c.expires)<new Date())||(c.usage_limit&&c.used>=c.usage_limit)||sub<c.min_order){return{off:0,code:''};}
  let off=Math.round(sub*c.percent/100); if(c.max_amount&&off>c.max_amount)off=c.max_amount; return{off,code:c.code};};
const loadCart=o=>{try{const r=db.prepare('SELECT data FROM carts WHERE owner=?').get(o);return r?JSON.parse(r.data):{}}catch(e){return{}}};
const saveCart=req=>{try{const c=req.session&&req.session.cart||{},uid=req.session&&req.session.userId||null,o=uid?'u:'+uid:'s:'+req.sessionID;
  if(!Object.keys(c).length)db.prepare('DELETE FROM carts WHERE owner=?').run(o);else db.prepare("INSERT OR REPLACE INTO carts(owner,user_id,data,updated) VALUES(?,?,?,datetime('now'))").run(o,uid,JSON.stringify(c));
  if(uid)db.prepare('DELETE FROM carts WHERE owner=?').run('s:'+req.sessionID);}catch(e){}};
app.use((req,res,next)=>{if(req.method==='POST'&&!req.path.startsWith(ADM)){const sid=req.sessionID;res.on('finish',()=>{if(req.session&&req.session.cart)saveCart(req)})}next()});
const cartItems=req=>{const ids=Object.keys(req.session.cart).map(Number).filter(Boolean);if(!ids.length)return{items:[],sub:0,off:0,code:''};
  const rows=db.prepare(`SELECT * FROM products WHERE active=1 AND id IN (${ids.map(()=>'?').join(',')})`).all(...ids);
  const items=rows.map(p=>({p,qty:Math.min(req.session.cart[p.id],p.stock||0)||0,price:finalPrice(p)})).filter(i=>i.qty>0);
  const sub=items.reduce((a,i)=>a+i.price*i.qty,0);return{items,sub,...couponCalc(req,sub)};};
const isCollect=(S,items)=>S.ship_collect==='1'||(items&&items.length>0&&items.every(i=>i.p.ship_collect));
const shipping=(S,sub,m,items)=>isCollect(S,items)||sub===0||sub>=+S.free_shipping?0:(m==='tipax'?+(S.tipax_fee||S.shipping_fee):+S.shipping_fee);
const METHODS={pishtaz:'پست پیشتاز',tipax:'تیپاکس'};
app.get('/cart',(req,res)=>{const c=cartItems(req);res.render('cart',{...c,collect:isCollect(res.locals.S,c.items),ship:shipping(res.locals.S,c.sub-c.off,'',c.items)});});
app.post('/cart/add',(req,res)=>{const id=+req.body.id,q=Math.min(20,Math.max(1,+req.body.qty||1));
  if(!db.prepare('SELECT 1 FROM products WHERE id=? AND active=1').get(id)) return res.status(404).json({});
  req.session.cart[id]=Math.min(50,(req.session.cart[id]||0)+q);
  if(req.body.ajax) return res.json({count:Object.values(req.session.cart).reduce((a,b)=>a+b,0)}); res.redirect('/cart');});
app.post('/cart/set',(req,res)=>{const id=+req.body.id,q=Math.floor(+req.body.qty);if(!(q>0))delete req.session.cart[id];else req.session.cart[id]=Math.min(50,q);res.redirect('/cart');});
app.post('/cart/remove',(req,res)=>{delete req.session.cart[+req.body.id];if(req.body.ajax)return res.json({ok:1,count:Object.values(req.session.cart).reduce((a,b)=>a+b,0)});req.session.flash='محصول از سبد حذف شد';res.redirect('/cart');});
app.post('/cart/clear',(req,res)=>{req.session.cart={};delete req.session.coupon;res.redirect('/cart');});
app.post('/cart/coupon',(req,res)=>{const code=String(req.body.code||'').trim().toUpperCase();
  if(!code){delete req.session.coupon;return res.redirect('/cart');}
  const c=db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').get(code);
  if(!c){req.session.flash='کد تخفیف معتبر نیست';delete req.session.coupon;}else{req.session.coupon=code;req.session.flash='کد تخفیف اعمال شد';}res.redirect('/cart');});
const profileOk=u=>u&&u.first_name&&u.last_name&&db.prepare("SELECT 1 FROM addresses WHERE user_id=? AND postal_code<>'' AND address<>''").get(u.id);
app.get('/checkout',(req,res)=>{if(!req.session.userId){req.session.next='/checkout';return res.redirect('/login');}
  if(!profileOk(res.locals.user)){req.session.flash='برای ثبت سفارش ابتدا اطلاعات خود را تکمیل کنید';return res.redirect('/account/complete?next=/checkout');}
  const c=cartItems(req);if(!c.items.length)return res.redirect('/cart');res.render('checkout',{...c,addrs:addrs(req.session.userId),collect:isCollect(res.locals.S,c.items),ship:shipping(res.locals.S,c.sub-c.off,'',c.items),shipT:shipping(res.locals.S,c.sub-c.off,'tipax',c.items),shipP:shipping(res.locals.S,c.sub-c.off,'pishtaz',c.items)});});
app.post('/checkout',(req,res)=>{
  if(!req.session.userId) return res.redirect('/login'); if(!profileOk(res.locals.user)) return res.redirect('/account/complete?next=/checkout'); const c=cartItems(req); if(!c.items.length) return res.redirect('/cart');
  const b=req.body,cl=(x,n=500)=>String(x||'').trim().slice(0,n),fd=x=>String(x||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const method=METHODS[b.ship_method]?b.ship_method:'pishtaz',postal=fd(b.postal_code).replace(/\D/g,''),phone=fd(b.phone).replace(/\D/g,'');
  const bad=!cl(b.name)||!/^09\d{9}$/.test(phone)||!/^\d{10}$/.test(postal)||!cl(b.province)||!cl(b.city)||!cl(b.address);
  if(bad){req.session.flash='لطفاً نام، موبایل (۰۹…)، استان، شهر، کد پستی ۱۰ رقمی و آدرس را درست وارد کنید';return res.redirect('/checkout');}
  const ship=shipping(res.locals.S,c.sub-c.off,method,c.items),col=isCollect(res.locals.S,c.items)?1:0,total=c.sub-c.off+ship;
  const r=db.prepare('INSERT INTO orders(user_id,total,name,phone,address,note,coupon,discount_amount,province,city,postal_code,ship_method,ship_cost,ship_collect) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(req.session.userId,total,cl(b.name,100),phone,cl(b.address),cl(b.note),c.code,c.off,cl(b.province,50),cl(b.city,50),postal,method,ship,col);
  if(c.code)db.prepare('UPDATE coupons SET used=used+1 WHERE code=?').run(c.code);
  const ins=db.prepare('INSERT INTO order_items(order_id,product_id,name,price,qty) VALUES(?,?,?,?,?)');
  c.items.forEach(i=>{ins.run(r.lastInsertRowid,i.p.id,i.p.name,i.price,i.qty);db.prepare('UPDATE products SET stock=MAX(0,stock-?) WHERE id=?').run(i.qty,i.p.id);});
  req.session.cart={};delete req.session.coupon; // TODO: redirect to payment gateway
  res.redirect('/account/orders/'+r.lastInsertRowid+'?new=1');
});

// ---------- user auth (OTP)
const mask=p=>p.slice(0,4)+'***'+p.slice(-3);
const smsRec=(phone,kind,ok,msg)=>{try{db.prepare('INSERT INTO sms_log(phone,kind,ok,msg) VALUES(?,?,?,?)').run(mask(phone),kind,ok?1:0,String(msg||'').slice(0,120));db.prepare('DELETE FROM sms_log WHERE id NOT IN (SELECT id FROM sms_log ORDER BY id DESC LIMIT 200)').run()}catch(e){}};
const sendSms=async(phone,code,kind='login')=>{const S=getSettings();console.log(`[OTP] ${phone} => ${process.env.OTP_DEV==='0'?'***':code}`);
  if(!S.sms_key||!S.sms_template||S.sms_on==='0')return{ok:false,why:'not configured'};
  try{const r=await fetch('https://api.sms.ir/v1/send/verify',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','x-api-key':S.sms_key},
    body:JSON.stringify({mobile:phone,templateId:+S.sms_template,parameters:[{name:S.sms_param||'Code',value:String(code)}]}),signal:AbortSignal.timeout(10000)});
    const j=await r.json().catch(()=>({}));const ok=r.ok&&j.status===1;smsRec(phone,kind,ok,j.message||('HTTP '+r.status));
    if(!ok)console.error('[SMS] fail',r.status,j.message);return{ok,msg:j.message}}catch(e){smsRec(phone,kind,false,e.message);console.error('[SMS] error',e.message);return{ok:false,msg:e.message}}};
const PASS_MIN=6,fdig=x=>String(x||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
const rl=(res,o)=>res.render('login',{mode:'login',step:'phone',phone:'',devCode:null,...o});
const issueOtp=phone=>{const last=db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);
  if(last&&last.expires-120000+60000>Date.now())return{err:'لطفاً یک دقیقه صبر کنید'};
  const code=String(crypto.randomInt(10000,100000));db.prepare('DELETE FROM otps WHERE phone=?').run(phone);
  db.prepare('INSERT INTO otps(phone,code,expires) VALUES(?,?,?)').run(phone,crypto.createHash('sha256').update(code+SECRET).digest('hex'),Date.now()+120000);sendSms(phone,code);
  const smsOn=(()=>{const S=getSettings();return S.sms_key&&S.sms_template&&S.sms_on!=='0'})();return{code:(process.env.OTP_DEV==='0'||smsOn)?null:code};};
const checkOtp=(phone,code)=>{const o=db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);const h=crypto.createHash('sha256').update(fdig(code)+SECRET).digest('hex');
  if(!o||o.expires<Date.now()||o.tries>=5||o.code!==h){if(o)db.prepare('UPDATE otps SET tries=tries+1 WHERE phone=?').run(phone);return false;}
  db.prepare('DELETE FROM otps WHERE phone=?').run(phone);return true;};
const loginAs=(req,res,u,to)=>{const oldSid=req.sessionID,keep={cart:req.session.cart,next:req.session.next};req.session.regenerate(()=>{Object.assign(req.session,keep,{userId:u.id});
  const sv=loadCart('u:'+u.id);for(const[k,q]of Object.entries(sv))req.session.cart[k]=Math.min(50,Math.max(req.session.cart[k]||0,q));
  db.prepare('DELETE FROM carts WHERE owner=?').run('s:'+oldSid);saveCart(req);const n=req.session.next;delete req.session.next;res.redirect(to||(n&&n.startsWith('/')?n:'/account'));});};
const lim=limiter(10,10,'تلاش بیش از حد. ۱۰ دقیقه دیگر دوباره امتحان کنید.');
// password login
app.get('/login',(req,res)=>{if(req.session.userId)return res.redirect('/account');rl(res,{mode:req.query.otp?'otp':'login'});});
app.post('/login/password',lim,(req,res)=>{const phone=normPhone(req.body.phone),u=phone&&db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if(!u||!u.password||!bcrypt.compareSync(String(req.body.password||''),u.password))return rl(res,{phone:phone||'',error:'شماره یا رمز عبور اشتباه است'});
  if(u.blocked)return rl(res,{error:'حساب شما مسدود شده است'});loginAs(req,res,u);});
// register / forgot (OTP -> set password)
for(const mode of ['register','forgot']){
  app.get('/'+mode,(req,res)=>rl(res,{mode}));
  app.post('/'+mode+'/send',lim,(req,res)=>{const phone=normPhone(req.body.phone);if(!phone)return rl(res,{mode,error:'شماره موبایل معتبر نیست'});
    const u=db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
    if(mode==='register'&&u)return rl(res,{mode:u.password?'login':'forgot',phone,error:u.password?'این شماره قبلاً ثبت‌نام کرده است. وارد شوید یا رمز را بازیابی کنید.':'این شماره قبلاً ثبت شده و هنوز رمز ندارد. با «فراموشی رمز» برایش رمز بسازید.'});
    if(mode==='forgot'&&!u)return rl(res,{mode,error:'کاربری با این شماره پیدا نشد. ابتدا ثبت‌نام کنید.'});
    const r=issueOtp(phone);if(r.err)return rl(res,{mode,step:'code',phone,error:r.err});rl(res,{mode,step:'code',phone,devCode:r.code});});
  app.post('/'+mode+'/verify',lim,(req,res)=>{const phone=normPhone(req.body.phone);
    if(!phone||!checkOtp(phone,req.body.code))return rl(res,{mode,step:'code',phone:phone||'',error:'کد نادرست یا منقضی شده است'});
    req.session.vp={phone,mode,exp:Date.now()+10*60000};rl(res,{mode,step:'password',phone});});
  app.post('/'+mode+'/password',lim,(req,res)=>{const v=req.session.vp;
    if(!v||v.mode!==mode||v.exp<Date.now())return rl(res,{mode,error:'زمان تایید شما تمام شد؛ دوباره کد بگیرید'});
    if(mode==='register'&&db.prepare('SELECT 1 FROM users WHERE phone=?').get(v.phone))return rl(res,{mode:'login',phone:v.phone,error:'این شماره قبلاً ثبت‌نام کرده است.'});
    const p=String(req.body.password||'');
    if(p.length<PASS_MIN)return rl(res,{mode,step:'password',phone:v.phone,error:'رمز عبور باید حداقل ۶ کاراکتر باشد'});
    if(p!==String(req.body.password2||''))return rl(res,{mode,step:'password',phone:v.phone,error:'تکرار رمز با رمز یکسان نیست'});
    const hash=bcrypt.hashSync(p,10);delete req.session.vp;
    if(mode==='register'){db.prepare('INSERT OR IGNORE INTO users(phone) VALUES(?)').run(v.phone);db.prepare('UPDATE users SET password=? WHERE phone=?').run(hash,v.phone);
      const u=db.prepare('SELECT * FROM users WHERE phone=?').get(v.phone);if(u.blocked)return rl(res,{error:'حساب شما مسدود شده است'});
      req.session.flash='ثبت‌نام انجام شد! اطلاعات ارسال خود را تکمیل کنید';return loginAs(req,res,u,'/account/complete');}
    db.prepare('UPDATE users SET password=? WHERE phone=?').run(hash,v.phone);rl(res,{mode:'login',phone:v.phone,ok:'رمز عبور با موفقیت تغییر کرد. وارد شوید.'});});
}
// OTP-only login (legacy)
app.post('/login/send',limiter(6,10,'تلاش بیش از حد. ۱۰ دقیقه دیگر دوباره امتحان کنید.'),(req,res)=>{
  const phone=normPhone(req.body.phone); if(!phone) return rl(res,{mode:'otp',error:'شماره موبایل معتبر نیست'});
  const r=issueOtp(phone);if(r.err)return rl(res,{mode:'otp',step:'code',phone,error:r.err});rl(res,{mode:'otp',step:'code',phone,devCode:r.code});});
app.post('/login/verify',limiter(12,10,'تلاش بیش از حد.'),(req,res)=>{
  const phone=normPhone(req.body.phone);
  if(!phone||!checkOtp(phone,req.body.code))return rl(res,{mode:'otp',step:'code',phone:phone||'',error:'کد نادرست یا منقضی شده است'});
  db.prepare('INSERT OR IGNORE INTO users(phone) VALUES(?)').run(phone);
  const u=db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if(u.blocked) return rl(res,{error:'حساب شما مسدود شده است'});
  loginAs(req,res,u);});
app.post('/logout',(req,res)=>{saveCart(req);delete req.session.userId;req.session.cart={};delete req.session.coupon;res.redirect('/');});
const needUser=(req,res,next)=>{if(!req.session.userId||!res.locals.user)return res.redirect('/login');if(res.locals.user.blocked){delete req.session.userId;return res.redirect('/login');}next();};
// complete profile
app.get('/account/complete',needUser,(req,res)=>res.render('complete',{a:addrs(res.locals.user.id)[0]||{},next:String(req.query.next||'/account').startsWith('/')?String(req.query.next||'/account'):'/account'}));
app.post('/account/complete',needUser,(req,res)=>{const b=req.body,u=res.locals.user,cl=(x,n)=>String(x||'').trim().slice(0,n),postal=fdig(b.postal_code),nx=String(b.next||'/account').startsWith('/')?String(b.next):'/account';
  if(!cl(b.first_name,60)||!cl(b.last_name,60)||!cl(b.province,50)||!cl(b.city,50)||!cl(b.address,500)||!/^\d{10}$/.test(postal)){req.session.flash='همه فیلدها الزامی است و کد پستی باید ۱۰ رقم باشد';return res.redirect('/account/complete?next='+encodeURIComponent(nx));}
  db.prepare('UPDATE users SET first_name=?,last_name=?,email=? WHERE id=?').run(cl(b.first_name,60),cl(b.last_name,60),cl(b.email,120),u.id);
  const full=cl(b.first_name,60)+' '+cl(b.last_name,60),ex=addrs(u.id)[0];
  if(ex)db.prepare('UPDATE addresses SET receiver=?,receiver_phone=?,province=?,city=?,postal_code=?,address=? WHERE id=?').run(full,u.phone,cl(b.province,50),cl(b.city,50),postal,cl(b.address,500),ex.id);
  else db.prepare("INSERT INTO addresses(user_id,title,address,receiver,receiver_phone,province,city,postal_code,is_default) VALUES(?,?,?,?,?,?,?,?,1)").run(u.id,'منزل',cl(b.address,500),full,u.phone,cl(b.province,50),cl(b.city,50),postal);
  syncDef(u.id);req.session.flash='اطلاعات شما تکمیل شد';res.redirect(nx);});
// change / set password
app.post('/account/password',needUser,lim,(req,res)=>{const u=res.locals.user,p=String(req.body.password||'');
  if(u.password&&!bcrypt.compareSync(String(req.body.current||''),u.password)){req.session.flash='رمز فعلی اشتباه است';return res.redirect('/account#pw');}
  if(p.length<PASS_MIN||p!==String(req.body.password2||'')){req.session.flash='رمز حداقل ۶ کاراکتر و تکرار آن یکسان باشد';return res.redirect('/account#pw');}
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(p,10),u.id);req.session.flash='رمز عبور ذخیره شد';res.redirect('/account#pw');});
const addrs=uid=>db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id DESC').all(uid);
const syncDef=uid=>{const d=db.prepare('SELECT * FROM addresses WHERE user_id=? AND is_default=1').get(uid)||db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY id DESC').get(uid);
  if(d){db.prepare('UPDATE addresses SET is_default=(id=?) WHERE user_id=?').run(d.id,uid);db.prepare('UPDATE users SET address=?,lat=?,lng=? WHERE id=?').run(d.address,d.lat,d.lng,uid);}else db.prepare("UPDATE users SET address='',lat=NULL,lng=NULL WHERE id=?").run(uid);};
app.get('/account',needUser,(req,res)=>{const u=res.locals.user;res.render('account',{addrs:addrs(u.id),ocount:db.prepare('SELECT COUNT(*) c FROM orders WHERE user_id=?').get(u.id).c});});
app.post('/account',needUser,(req,res)=>{
  const b=req.body;db.prepare('UPDATE users SET first_name=?,last_name=?,email=? WHERE id=?')
   .run(String(b.first_name||'').slice(0,60),String(b.last_name||'').slice(0,60),String(b.email||'').slice(0,120),req.session.userId);
  req.session.flash='اطلاعات ذخیره شد';res.redirect('/account');});
const num=x=>x!==''&&x!=null&&isFinite(+x)?+x:null;
app.post('/account/address',needUser,(req,res)=>{const b=req.body,uid=req.session.userId,cl=(x,n)=>String(x||'').trim().slice(0,n),fd=x=>String(x||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),a=cl(b.address,500);
  const postal=fd(b.postal_code).replace(/\D/g,''),rp=fd(b.receiver_phone).replace(/\D/g,'');
  if(!a||!cl(b.receiver,100)||!/^09\d{9}$/.test(rp)||!/^\d{10}$/.test(postal)||!cl(b.province,50)||!cl(b.city,50)){req.session.flash='نام گیرنده، موبایل، استان، شهر، کد پستی ۱۰ رقمی و آدرس الزامی است';return res.redirect('/account#addr');}
  const t=cl(b.title,40)||'آدرس',id=+b.id,v=[t,a,num(b.lat),num(b.lng),cl(b.receiver,100),rp,cl(b.province,50),cl(b.city,50),postal];
  if(id&&db.prepare('SELECT 1 FROM addresses WHERE id=? AND user_id=?').get(id,uid))db.prepare('UPDATE addresses SET title=?,address=?,lat=?,lng=?,receiver=?,receiver_phone=?,province=?,city=?,postal_code=? WHERE id=?').run(...v,id);
  else{if(db.prepare('SELECT COUNT(*) c FROM addresses WHERE user_id=?').get(uid).c>=10){req.session.flash='حداکثر ۱۰ آدرس';return res.redirect('/account#addr');}
   const first=!db.prepare('SELECT 1 FROM addresses WHERE user_id=?').get(uid);db.prepare('INSERT INTO addresses(title,address,lat,lng,receiver,receiver_phone,province,city,postal_code,user_id,is_default) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...v,uid,first?1:0);}
  syncDef(uid);req.session.flash='آدرس ذخیره شد';res.redirect('/account#addr');});
app.post('/account/address/:id/default',needUser,(req,res)=>{const uid=req.session.userId;if(db.prepare('SELECT 1 FROM addresses WHERE id=? AND user_id=?').get(+req.params.id,uid)){db.prepare('UPDATE addresses SET is_default=(id=?) WHERE user_id=?').run(+req.params.id,uid);syncDef(uid);req.session.flash='آدرس پیش‌فرض تغییر کرد';}res.redirect('/account#addr');});
app.post('/account/address/:id/delete',needUser,(req,res)=>{const uid=req.session.userId;db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(+req.params.id,uid);syncDef(uid);req.session.flash='آدرس حذف شد';res.redirect('/account#addr');});
app.get('/account/orders',needUser,(req,res)=>res.render('orders',{orders:db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.session.userId).map(o=>({...o,items:db.prepare('SELECT oi.*,p.image FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE order_id=?').all(o.id)}))}));
app.get('/account/orders/:id',needUser,(req,res)=>{const o=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(+req.params.id,req.session.userId);
  if(!o)return res.status(404).render('404');res.render('order',{o,items:db.prepare('SELECT oi.*,p.image,p.slug FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE order_id=?').all(o.id),fresh:!!req.query.new});});

// ---------- SEO
app.get('/robots.txt',(req,res)=>res.type('text').send(`User-agent: *\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nSitemap: ${SITE}/sitemap.xml\n`));
app.get('/sitemap.xml',(req,res)=>{
  const u=['/','/shop','/page/about',...db.prepare('SELECT slug FROM categories').all().map(c=>'/category/'+encodeURI(c.slug)),...db.prepare('SELECT slug FROM products WHERE active=1').all().map(p=>'/product/'+encodeURI(p.slug))];
  res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${u.map(x=>`<url><loc>${SITE}${x}</loc></url>`).join('')}</urlset>`);});

// ---------- admin
const A=express.Router();
A.get('/login',(req,res)=>res.render("admin/login"));
A.post('/login',limiter(8,15,'تلاش ورود بیش از حد. ۱۵ دقیقه صبر کنید.'),(req,res)=>{const a=db.prepare('SELECT * FROM admins WHERE username=?').get(req.body.username||'');
  if(a&&bcrypt.compareSync(req.body.password||'',a.password)){const keep={};req.session.regenerate(()=>{req.session.adminId=a.id;audit(req,'login ok');res.redirect(ADM);});return;}
  audit(req,'login FAIL '+String(req.body.username||'').slice(0,30));
  res.render('admin/login',{error:'نام کاربری یا رمز اشتباه است'});});
A.post('/logout',(req,res)=>{delete req.session.adminId;res.redirect(ADM+'/login');});
A.use((req,res,next)=>req.session.adminId?next():res.redirect(ADM+'/login'));
const flash=(req,m)=>req.session.flash=m;
A.get('/',(req,res)=>{const n=t=>db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  res.render('admin/dashboard',{stats:{products:n('products'),orders:n('orders'),users:n('users'),cats:n('categories'),revenue:db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ('paid','shipped','done')").get().s},
   recent:db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 5').all(),low:db.prepare('SELECT * FROM products WHERE stock<=3 AND active=1').all(),top:db.prepare('SELECT name,views FROM products ORDER BY views DESC LIMIT 5').all(),days:db.prepare("SELECT substr(created,1,10) d,SUM(total) s FROM orders GROUP BY d ORDER BY d DESC LIMIT 7").all().reverse()});});
// products
A.get('/products',(req,res)=>res.render('admin/products',{rows:db.prepare('SELECT p.*,COALESCE(pc.name,c.name) cat,CASE WHEN pc.id IS NOT NULL THEN c.name ELSE \'\' END subcat FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN categories pc ON pc.id=c.parent_id ORDER BY p.id DESC').all()}));
A.get('/products/new',(req,res)=>res.render('admin/product_form',{p:{price:0,discount:0,stock:10},gallery:[]}));
A.get('/products/:id',(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(+req.params.id);if(!p)return res.redirect(ADM+'/products');res.render('admin/product_form',{p,gallery:db.prepare('SELECT * FROM product_images WHERE product_id=?').all(p.id)});});
A.post('/gallery/:id/delete',(req,res)=>{const g=db.prepare('SELECT * FROM product_images WHERE id=?').get(+req.params.id);db.prepare('DELETE FROM product_images WHERE id=?').run(+req.params.id);res.redirect(ADM+'/products/'+(g?g.product_id:''));});
A.post('/products/save',upload.fields([{name:'image',maxCount:1},{name:'gallery',maxCount:6}]),(req,res)=>{
  req.file=(req.files&&req.files.image||[])[0];
  const b=req.body,id=+b.id||0,img=req.file?'/uploads/'+req.file.filename:(b.old_image||'');
  let slug=slugify(b.name);
  const v=[b.name,b.brief||'',b.description||'',+b.price||0,Math.min(95,Math.max(0,+b.discount||0)),img,b.brand||'',+b.category_id||null,+b.stock||0,b.featured?1:0,((+b.discount||0)>0&&b.deal_ends)?1:0,((+b.discount||0)>0&&b.deal_ends)?new Date(b.deal_ends).toISOString():'',b.active?1:0,b.ingredients||'',b.how_to_use||'',b.size||'',b.features||'',b.ship_collect?1:0];
  if(id) db.prepare('UPDATE products SET name=?,brief=?,description=?,price=?,discount=?,image=?,brand=?,category_id=?,stock=?,featured=?,daily_deal=?,deal_ends=?,active=?,ingredients=?,how_to_use=?,size=?,features=?,ship_collect=? WHERE id=?').run(...v,id);
  else{if(db.prepare('SELECT 1 FROM products WHERE slug=?').get(slug))slug+='-'+crypto.randomBytes(2).toString('hex');
    db.prepare('INSERT INTO products(name,brief,description,price,discount,image,brand,category_id,stock,featured,daily_deal,deal_ends,active,ingredients,how_to_use,size,features,ship_collect,slug) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...v,slug);}
  const pid=id||db.prepare('SELECT id FROM products WHERE slug=?').get(slug).id;
  (req.files&&req.files.gallery||[]).forEach(f=>db.prepare('INSERT INTO product_images(product_id,path) VALUES(?,?)').run(pid,'/uploads/'+f.filename));
  audit(req,'product save '+b.name);
  flash(req,'محصول ذخیره شد');res.redirect(ADM+'/products');});
A.post('/products/:id/delete',(req,res)=>{db.prepare('DELETE FROM products WHERE id=?').run(+req.params.id);res.redirect(ADM+'/products');});
A.post('/products/clear-discounts',(req,res)=>{db.prepare("UPDATE products SET discount=0,daily_deal=0,deal_ends=''").run();audit(req,'clear all product discounts');flash(req,'تخفیف همه محصولات حذف شد');res.redirect(ADM+'/products');});
A.post('/products/bulk-deal-time',(req,res)=>{const b=req.body;let iso='';if(b.deal_ends){const d=new Date(b.deal_ends);if(!isNaN(d))iso=d.toISOString()}
  const cat=+b.category_id||0,w=cat?' WHERE category_id=?':'',args=cat?[cat]:[];
  const r=db.prepare('UPDATE products SET deal_ends=?'+w).run(iso,...args);
  if(iso&&b.enable)db.prepare('UPDATE products SET daily_deal=1 WHERE discount>0'+(cat?' AND category_id=?':'')).run(...args);
  if(!iso)db.prepare('UPDATE products SET daily_deal=0'+w).run(...args);
  audit(req,'bulk deal time '+iso);flash(req,iso?'زمان پایان تخفیف برای '+r.changes+' محصول تنظیم شد':'زمان و تخفیف روز همه محصولات پاک شد');res.redirect(ADM+'/products');});
A.post('/products/bulk-discount',(req,res)=>{const b=req.body,d=Math.min(95,Math.max(0,+b.discount||0));let iso='';if(d>0&&b.deal_ends){const t=new Date(b.deal_ends);if(!isNaN(t))iso=t.toISOString()}
  const cat=+b.category_id||0,w=cat?' WHERE category_id=?':'',args=cat?[cat]:[];
  const r=db.prepare('UPDATE products SET discount=?,deal_ends=?,daily_deal=? '+w).run(d,iso,iso?1:0,...args);
  audit(req,'bulk discount '+d+' '+iso);flash(req,d?('تخفیف ٪'+d+' روی '+r.changes+' محصول اعمال شد'+(iso?' (زمان‌دار)':'')):'تخفیف '+r.changes+' محصول حذف شد');res.redirect(ADM+'/products');});
// categories
A.get('/categories',(req,res)=>res.render('admin/categories',{rows:db.prepare('SELECT c.*,(SELECT COUNT(*) FROM products WHERE category_id=c.id) n FROM categories c ORDER BY sort,id').all()}));
A.post('/categories/save',upload.single('image'),(req,res)=>{const b=req.body,id=+b.id||0,img=req.file?'/uploads/'+req.file.filename:(b.old_image||'');
  if(id)db.prepare('UPDATE categories SET name=?,image=?,sort=?,parent_id=? WHERE id=?').run(b.name,img,+b.sort||0,(+b.parent_id&&+b.parent_id!==id)?+b.parent_id:0,id);
  else{let slug=slugify(b.name);if(db.prepare('SELECT 1 FROM categories WHERE slug=?').get(slug))slug+='-'+crypto.randomBytes(2).toString('hex');
    db.prepare('INSERT INTO categories(name,slug,image,sort,parent_id) VALUES(?,?,?,?,?)').run(b.name,slug,img,+b.sort||0,+b.parent_id||0);}
  res.redirect(ADM+'/categories');});
A.post('/categories/:id/delete',(req,res)=>{db.prepare('UPDATE products SET category_id=NULL WHERE category_id=?').run(+req.params.id);db.prepare('UPDATE categories SET parent_id=0 WHERE parent_id=?').run(+req.params.id);db.prepare('DELETE FROM categories WHERE id=?').run(+req.params.id);res.redirect(ADM+'/categories');});
// testimonials
A.get('/testimonials',(req,res)=>res.render('admin/testimonials',{rows:db.prepare('SELECT * FROM testimonials ORDER BY sort,id').all()}));
A.post('/testimonials/save',upload.none(),(req,res)=>{const b=req.body,id=+b.id||0,st=Math.min(5,Math.max(1,+b.stars||5));
  if(id)db.prepare('UPDATE testimonials SET name=?,text=?,stars=?,sort=?,active=? WHERE id=?').run(b.name,b.text,st,+b.sort||0,b.active?1:0,id);
  else db.prepare('INSERT INTO testimonials(name,text,stars,sort,active) VALUES(?,?,?,?,?)').run(b.name,b.text,st,+b.sort||0,b.active?1:0);
  flash(req,'ذخیره شد');res.redirect(ADM+'/testimonials');});
A.post('/testimonials/:id/delete',(req,res)=>{db.prepare('DELETE FROM testimonials WHERE id=?').run(+req.params.id);res.redirect(ADM+'/testimonials');});
// banners
A.get('/banners',(req,res)=>res.render('admin/banners',{rows:db.prepare('SELECT * FROM banners ORDER BY sort,id').all()}));
const BNI=['bottle','flower','lipstick','perfume','drop','spark','eye','gift','star','fire','shield','truck','soap','hair','eyeshadow','ticket','bag'];
A.post('/banners/save',upload.single('image'),(req,res)=>{const b=req.body,icon=b.icon==='none'||BNI.includes(b.icon)?b.icon:'',id=+b.id||0,img=req.file?'/uploads/'+req.file.filename:(/^\/presets\/b\d+\.svg$/.test(b.preset||'')?b.preset:(b.old_image||''));
  if(id)db.prepare('UPDATE banners SET title=?,subtitle=?,link=?,image=?,sort=?,active=?,icon=? WHERE id=?').run(b.title,b.subtitle||'',b.link||'/',img,+b.sort||0,b.active?1:0,icon,id);
  else db.prepare('INSERT INTO banners(title,subtitle,link,image,sort,active,icon) VALUES(?,?,?,?,?,?,?)').run(b.title,b.subtitle||'',b.link||'/',img,+b.sort||0,b.active?1:0,icon);
  res.redirect(ADM+'/banners');});
A.post('/banners/:id/delete',(req,res)=>{db.prepare('DELETE FROM banners WHERE id=?').run(+req.params.id);res.redirect(ADM+'/banners');});
// orders / users
A.get('/orders',(req,res)=>{const st=req.query.status||'';const rows=st?db.prepare('SELECT * FROM orders WHERE status=? ORDER BY id DESC').all(st):db.prepare('SELECT * FROM orders ORDER BY id DESC').all();const cnt=Object.fromEntries(db.prepare('SELECT status,COUNT(*) c FROM orders GROUP BY status').all().map(r=>[r.status,r.c]));res.render('admin/orders',{rows,st,cnt});});
A.get('/orders/:id',(req,res)=>{const o=db.prepare('SELECT * FROM orders WHERE id=?').get(+req.params.id);res.render('admin/order',{o,items:db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)});});
A.post('/orders/:id/status',(req,res)=>{db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,+req.params.id);res.redirect(ADM+'/orders/'+req.params.id);});
A.get('/carts',(req,res)=>{db.prepare("DELETE FROM carts WHERE updated<datetime('now','-30 day')").run();
  const rows=db.prepare('SELECT c.*,u.first_name,u.last_name,u.phone,u.email FROM carts c LEFT JOIN users u ON u.id=c.user_id ORDER BY c.updated DESC').all().map(r=>{const d=JSON.parse(r.data||'{}'),ids=Object.keys(d).map(Number).filter(Boolean);
    const ps=ids.length?db.prepare(`SELECT id,name,price,discount FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`).all(...ids):[];
    const items=ps.map(p=>({name:p.name,qty:d[p.id],price:finalPrice(p)}));return{...r,items,total:items.reduce((a,i)=>a+i.price*i.qty,0)}}).filter(r=>r.items.length);
  res.render('admin/carts',{rows});});
A.get('/users',(req,res)=>res.render('admin/users',{rows:db.prepare('SELECT u.*,(SELECT COUNT(*) FROM orders WHERE user_id=u.id) n FROM users u ORDER BY id DESC').all()}));
// settings (store/seller info + SEO)
A.get('/settings',(req,res)=>res.render('admin/settings',{smsLog:db.prepare('SELECT * FROM sms_log ORDER BY id DESC LIMIT 5').all(),smsStat:db.prepare('SELECT COUNT(*) n,COALESCE(SUM(ok),0) ok FROM sms_log').get()}));
A.post('/sms-test',upload.none(),async(req,res)=>{const ph=normPhone(req.body.phone);if(!ph){flash(req,'شماره معتبر نیست');return res.redirect(ADM+'/settings');}
  const r=await sendSms(ph,String(crypto.randomInt(10000,100000)),'test');flash(req,r.ok?'پیامک آزمایشی ارسال شد':'ارسال ناموفق: '+(r.msg||r.why||'خطا'));res.redirect(ADM+'/settings');});
A.post('/settings',upload.none(),(req,res)=>{const st=db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)');for(const[k,v]of Object.entries(req.body)){if(k==='_csrf')continue;if(k==='sms_key'&&!String(Array.isArray(v)?v[v.length-1]:v).trim())continue;st.run(k,String(Array.isArray(v)?v[v.length-1]:v));}flash(req,'تنظیمات ذخیره شد');res.redirect(ADM+'/settings');});
A.post('/account',(req,res)=>{const b=req.body;
  const me=db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.adminId);
  if(!bcrypt.compareSync(b.current||'',me.password)){flash(req,'رمز فعلی اشتباه است');return res.redirect(ADM+'/settings');}
  if(b.username)db.prepare('UPDATE admins SET username=? WHERE id=?').run(b.username,req.session.adminId);
  if(b.password&&b.password.length>=6)db.prepare('UPDATE admins SET password=? WHERE id=?').run(bcrypt.hashSync(b.password,12),req.session.adminId);
  flash(req,'اطلاعات ورود مدیر ذخیره شد');res.redirect(ADM+'/settings');});
A.get('/coupons',(req,res)=>res.render('admin/coupons',{rows:db.prepare('SELECT * FROM coupons ORDER BY id DESC').all()}));
A.post('/coupons/save',(req,res)=>{const b=req.body;try{db.prepare('INSERT INTO coupons(code,percent,max_amount,min_order,expires,usage_limit) VALUES(?,?,?,?,?,?)').run(String(b.code).trim().toUpperCase(),Math.min(100,+b.percent||0),+b.max_amount||0,+b.min_order||0,b.expires||'',+b.usage_limit||0);}catch(e){req.session.flash='کد تکراری است';}res.redirect(ADM+'/coupons');});
A.post('/coupons/:id/toggle',(req,res)=>{db.prepare('UPDATE coupons SET active=1-active WHERE id=?').run(+req.params.id);res.redirect(ADM+'/coupons');});
A.post('/coupons/:id/delete',(req,res)=>{db.prepare('DELETE FROM coupons WHERE id=?').run(+req.params.id);res.redirect(ADM+'/coupons');});
A.get('/reviews',(req,res)=>res.render('admin/reviews',{rows:db.prepare('SELECT r.*,p.name pname FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.id DESC').all()}));
A.post('/reviews/:id/toggle',(req,res)=>{db.prepare('UPDATE reviews SET approved=1-approved WHERE id=?').run(+req.params.id);res.redirect(ADM+'/reviews');});
A.post('/reviews/:id/delete',(req,res)=>{db.prepare('DELETE FROM reviews WHERE id=?').run(+req.params.id);res.redirect(ADM+'/reviews');});
A.post('/users/:id/delete',(req,res)=>{const id=+req.params.id;db.prepare('DELETE FROM addresses WHERE user_id=?').run(id);db.prepare('DELETE FROM users WHERE id=?').run(id);audit(req,'delete user '+id);flash(req,'کاربر حذف شد');res.redirect(ADM+'/users');});
A.post('/users/:id/block',(req,res)=>{db.prepare('UPDATE users SET blocked=1-blocked WHERE id=?').run(+req.params.id);audit(req,'toggle block user '+req.params.id);res.redirect(ADM+'/users');});
A.get('/audit',(req,res)=>res.render('admin/audit',{rows:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()}));
A.get('/payment',(req,res)=>res.render('admin/payment'));
app.use(ADM,(req,res,next)=>{res.locals.ST={pending_payment:['در انتظار پرداخت','warn'],paid:['پرداخت‌شده','ok'],shipped:['ارسال‌شده','info'],done:['تحویل‌شده','ok'],canceled:['لغوشده','bad']};res.locals.fd=d=>{try{return new Date(String(d).replace(' ','T')+'Z').toLocaleDateString('fa-IR')}catch(e){return d}};res.locals.ap=req.originalUrl.split('?')[0];res.locals.badge={orders:db.prepare("SELECT COUNT(*) c FROM orders WHERE status='pending_payment'").get().c,low:db.prepare('SELECT COUNT(*) c FROM products WHERE stock<=3 AND active=1').get().c};res.locals.admin=db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.adminId||0);next();},A);
app.use((req,res)=>res.status(404).render('404'));
app.use((e,req,res,next)=>{console.error(e.message);res.status(e.code==='LIMIT_FILE_SIZE'?413:500).send(e.code==='LIMIT_FILE_SIZE'?'حجم فایل زیاد است':'خطای سرور');});
app.listen(PORT,()=>console.log('VELORA on '+SITE));
