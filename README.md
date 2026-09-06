# سيرفر العقارات — حقيقي بالكامل

## التشغيل
```
npm install
cp .env.example .env
# املأ ADMIN_KEY وإعدادات SMTP
npm start
```

## الاستعمال
- افتح `admin.html` بدبل كليك، حط رابط السيرفر ومفتاح الإدارة، وابدأ ضيف عقارات — تظهر فورًا في موقع meridian-properties.html
- الموقع (`meridian-properties.html`) يقرأ العقارات مباشرة من السيرفر عبر BACKEND_URL في نهاية الملف
- كل طلب "Request info" من الموقع يتخزّن في قاعدة البيانات ويوصل إيميل حقيقي (إذا SMTP مضبوط)

## النشر
نفس خطوات مشروع المطعم بالضبط: Render/Railway للسيرفر، Netlify/Vercel للموقع.
