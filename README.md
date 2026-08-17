# LMS API (minimal scaffold)

اتبع الخطوات دي عشان تشغّل المشروع محليًا:

- **1 — ثبّت المتطلبات:** نزّل Node.js (v18+) و MySQL 8. على ويندوز أنسب حاجة XAMPP أو Laragon.
- **2 — انسخ المثال:** داخل المجلد `lms-api` نسخ `.env.example` إلى `.env` وغيّر `DB_PASSWORD` و `JWT_SECRET`.
- **3 — ثبّت الحزم:**

```bash
cd lms-api
npm install
```

- **4 — استورد الداتابيز:**

```bash
mysql -u root -p < database/schema.sql
```

- **5 — شغّل السيرفر (dev):**

```bash
npm run dev
```

- **6 — تحقق:** افتح `http://localhost:5000/api/health` و `http://localhost:5000/api/courses`.

- **7 — سجّل حساب & امنحه صلاحيات أدمن:** سجّل عبر `POST /api/auth/register` ثم نفّذ في MySQL:

```sql
UPDATE users SET role='ADMIN' WHERE email='you@example.com';
```
# courses_backend
