const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const db = new DatabaseSync(__dirname + '/velora.db');
db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, image TEXT DEFAULT '', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE, brief TEXT DEFAULT '', description TEXT DEFAULT '',
 price INTEGER, discount INTEGER DEFAULT 0, image TEXT DEFAULT '', brand TEXT DEFAULT '', category_id INTEGER, stock INTEGER DEFAULT 10,
 featured INTEGER DEFAULT 0, daily_deal INTEGER DEFAULT 0, deal_ends TEXT DEFAULT '', active INTEGER DEFAULT 1, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, phone TEXT UNIQUE, first_name TEXT DEFAULT '', last_name TEXT DEFAULT '', email TEXT DEFAULT '',
 address TEXT DEFAULT '', lat REAL, lng REAL, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS otps(phone TEXT, code TEXT, expires INTEGER, tries INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER, total INTEGER, status TEXT DEFAULT 'pending_payment',
 name TEXT, phone TEXT, address TEXT, note TEXT DEFAULT '', created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, name TEXT, price INTEGER, qty INTEGER);
CREATE TABLE IF NOT EXISTS banners(id INTEGER PRIMARY KEY, title TEXT, subtitle TEXT DEFAULT '', link TEXT DEFAULT '/', image TEXT DEFAULT '', active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
`);
const defaults = {
  store_name:'VELORA', tagline:'زیبایی، با شکوهی از جنس لوکس', phone:'021-00000000', mobile:'09120000000', email:'info@velora.ir',
  address:'تهران، خیابان ولیعصر، پلاک ۱', instagram:'velora', telegram:'', hours:'همه روزه ۹ تا ۲۱',
  about:'VELORA فروشگاه تخصصی محصولات آرایشی و بهداشتی اصل با ضمانت اصالت کالا.',
  seo_title:'VELORA | فروشگاه اینترنتی لوازم آرایشی و بهداشتی', seo_desc:'خرید آنلاین محصولات آرایشی، مراقبت پوست، مو و عطر اصل با بهترین قیمت و ارسال سریع از VELORA.',
  seo_keywords:'لوازم آرایشی, بهداشتی, مراقبت پوست, عطر, ولورا', free_shipping:'1500000', shipping_fee:'60000', map_lat:'35.7219', map_lng:'51.4150',
  footer_note:'تمام حقوق محفوظ است.'
};
Object.assign(defaults,{sec_banners:'1',sec_cats:'1',sec_deals:'1',sec_brands:'1',sec_featured:'1',sec_stats:'1',sec_latest:'1',sec_trust:'1',sec_testi:'1',sec_news:'1',
 stat1_val:'12000',stat1_label:'مشتری راضی',stat2_val:'850',stat2_label:'محصول اصل',stat3_val:'40',stat3_label:'برند معتبر',stat4_val:'99',stat4_label:'٪ رضایت',
 testi1_name:'سارا م.',testi1_text:'کیفیت سرم‌ها عالی بود و بسته‌بندی لوکس. حتماً دوباره خرید می‌کنم.',testi1_stars:'5',
 testi2_name:'نیلوفر ک.',testi2_text:'ارسال خیلی سریع بود و محصولات کاملاً اصل. تجربه خرید فوق‌العاده.',testi2_stars:'5',
 testi3_name:'مریم ع.',testi3_text:'سایت شیک و راحت، پیدا کردن محصول خیلی آسونه.',testi3_stars:'4'});
Object.assign(defaults,{brands_list:'VELORA\nROSE NOIR\nLUMI\nSILK VEIL\nVELORA LAB\nAURA\nLUXE\nBELLE',brands_speed:'25',mq_on:'1',mq_speed:'30',mq_text:'ارسال رایگان بالای ۲۰۰ هزار تومان\nضمانت اصالت کالا\nهدیه برای اولین خرید\n۷ روز ضمانت بازگشت'});
for (const [k,v] of Object.entries(defaults)) db.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run(k,v);
if (!db.prepare('SELECT 1 FROM admins').get()) db.prepare('INSERT INTO admins(username,password) VALUES(?,?)').run('admin', bcrypt.hashSync('admin123',10));
if (!db.prepare('SELECT 1 FROM categories').get()) {
  const cats=[['مراقبت پوست','skincare'],['آرایش صورت','makeup'],['آرایش چشم و ابرو','eyes'],['مراقبت مو','hair'],['عطر و ادکلن','perfume'],['بهداشتی','hygiene']];
  cats.forEach((c,i)=>db.prepare('INSERT INTO categories(name,slug,sort) VALUES(?,?,?)').run(c[0],c[1],i));
  db.prepare("INSERT INTO banners(title,subtitle,link) VALUES('مجموعه جدید مراقبت پوست','تا ۲۵٪ تخفیف ویژه','/category/skincare')").run();
  db.prepare("INSERT INTO banners(title,subtitle,link) VALUES('عطرهای اختصاصی VELORA','رایحه‌ای که ماندگار است','/category/perfume')").run();
}

const addCol=(t,c,def)=>{ if(!db.prepare(`PRAGMA table_info(${t})`).all().some(x=>x.name===c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
db.exec(`
CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY, product_id INTEGER, path TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, product_id INTEGER, user_id INTEGER, name TEXT, rating INTEGER, body TEXT, approved INTEGER DEFAULT 1, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS coupons(id INTEGER PRIMARY KEY, code TEXT UNIQUE, percent INTEGER DEFAULT 0, max_amount INTEGER DEFAULT 0, min_order INTEGER DEFAULT 0, expires TEXT DEFAULT '', usage_limit INTEGER DEFAULT 0, used INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, who TEXT, action TEXT, ip TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
`);
db.exec("CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT DEFAULT '', address TEXT, lat REAL, lng REAL, is_default INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP)");
db.exec("INSERT INTO addresses(user_id,title,address,lat,lng,is_default) SELECT id,'منزل',address,lat,lng,1 FROM users WHERE address<>'' AND id NOT IN (SELECT user_id FROM addresses)");
addCol('products','ingredients',"TEXT DEFAULT ''");addCol('products','how_to_use',"TEXT DEFAULT ''");addCol('products','size',"TEXT DEFAULT ''");
addCol('products','features',"TEXT DEFAULT ''");addCol('products','views','INTEGER DEFAULT 0');
addCol('orders','coupon',"TEXT DEFAULT ''");addCol('orders','discount_amount','INTEGER DEFAULT 0');addCol('users','blocked','INTEGER DEFAULT 0');
db.exec('CREATE TABLE IF NOT EXISTS carts(owner TEXT PRIMARY KEY, user_id INTEGER, data TEXT, updated TEXT DEFAULT CURRENT_TIMESTAMP)');
db.exec('CREATE TABLE IF NOT EXISTS sms_log(id INTEGER PRIMARY KEY, t TEXT DEFAULT CURRENT_TIMESTAMP, phone TEXT, kind TEXT, ok INTEGER, msg TEXT)');
db.exec('CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, data TEXT, expires INTEGER)');
addCol('users','password',"TEXT DEFAULT ''");
for(const c of ['receiver','receiver_phone','province','city','postal_code'])addCol('addresses',c,"TEXT DEFAULT ''");
for(const c of ['province','city','postal_code','ship_method'])addCol('orders',c,"TEXT DEFAULT ''");addCol('banners','icon',"TEXT DEFAULT ''");addCol('orders','ship_cost','INTEGER DEFAULT 0');addCol('orders','ship_collect','INTEGER DEFAULT 0');addCol('products','ship_collect','INTEGER DEFAULT 0');
db.prepare("INSERT OR IGNORE INTO settings VALUES('tipax_fee','90000')").run();
db.prepare("INSERT OR IGNORE INTO settings VALUES('pack_fee','0')").run();addCol('orders','pack_cost','INTEGER DEFAULT 0');addCol('orders','stock_out','INTEGER DEFAULT 0');addCol('admins','role',"TEXT DEFAULT 'owner'");addCol('admins','perms',"TEXT DEFAULT ''");addCol('admins','active','INTEGER DEFAULT 1');addCol('admins','created','TEXT');
if(!db.prepare("SELECT 1 FROM settings WHERE key='mig_stock_v2'").get()){ // old model deducted at checkout: give stock back for unpaid orders, mark paid/shipped/done as deducted
  db.prepare("SELECT id FROM orders WHERE status='pending_payment'").all().forEach(o=>db.prepare('SELECT product_id,qty FROM order_items WHERE order_id=?').all(o.id).forEach(i=>db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.qty,i.product_id)));
  db.prepare("UPDATE orders SET stock_out=1 WHERE status IN ('paid','shipped','done')").run();db.prepare("INSERT INTO settings VALUES('mig_stock_v2','1')").run();}
for (const [k,v] of Object.entries({hero_title:'زیبایی تو، امضای ما',hero_sub:'برترین برندهای آرایشی و بهداشتی اصل، با ضمانت اصالت و ارسال سریع'})) db.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run(k,v);
module.exports = db;

addCol('categories','parent_id','INTEGER DEFAULT 0');
db.exec('CREATE TABLE IF NOT EXISTS testimonials(id INTEGER PRIMARY KEY, name TEXT, text TEXT, stars INTEGER DEFAULT 5, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1)');
if(!db.prepare('SELECT 1 FROM testimonials').get()){const g=k=>{const r=db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r&&r.value};
 [1,2,3].forEach(i=>{if(g('testi'+i+'_text'))db.prepare('INSERT INTO testimonials(name,text,stars,sort) VALUES(?,?,?,?)').run(g('testi'+i+'_name'),g('testi'+i+'_text'),+g('testi'+i+'_stars')||5,i)})}
if(!db.prepare('SELECT 1 FROM categories WHERE parent_id>0').get()){
 const sub={skincare:['پاک‌کننده و شوینده','کرم و مرطوب‌کننده','سرم و ضدپیری','ضدآفتاب','ماسک صورت'],makeup:['رژلب','کرم پودر و کانسیلر','پنکک و رژگونه','هایلایتر و کانتور'],eyes:['ریمل','خط چشم و سایه','مداد و ژل ابرو','مژه مصنوعی'],hair:['شامپو','نرم‌کننده و ماسک مو','روغن و سرم مو','رنگ مو'],perfume:['عطر زنانه','عطر مردانه','اسپری بدن','بخور و خوشبو‌کننده'],hygiene:['دهان و دندان','مراقبت بدن','مراقبت دست و پا','بهداشت بانوان']};
 const ins=db.prepare('INSERT OR IGNORE INTO categories(name,slug,parent_id,sort) VALUES(?,?,?,?)');
 for(const [slug,arr] of Object.entries(sub)){const p=db.prepare('SELECT id FROM categories WHERE slug=?').get(slug);if(p)arr.forEach((n,i)=>ins.run(n,slug+'-'+(i+1),p.id,i))}}
