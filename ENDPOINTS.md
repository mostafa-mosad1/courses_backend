# API Endpoints — LMS API

ملف موجز يشرح كل endpoint، وظيفته، إذا كان يحتاج توثيق (تسجيل دخول) وإيش البيانات المتوقعة.

**ملاحظة:** بعض الراوتات مذكورة في README كاملة؛ هنا ملخّص وظيفي ومربوط بالمسارات الفعلية في المشروع.

---

## Auth (المصادقة)

- POST /api/auth/register
  - وصف: تسجيل مستخدم جديد.
  - حاجة Login: لا
  - body: { name, email, password }
  - رد: { success:true, data: { id, name, email } }

- POST /api/auth/login (غير مضافة افتراضيًا — يمكن إضافتها)
  - وصف: دخول مستخدم وإصدار JWT أو إعداد جلسة.
  - body: { email, password }
  - رد: { success:true, data: { token, user } }

---

## عام / Public

- GET /api/health
  - وصف: فحص الحالة البسيط.
  - حاجة Login: لا
  - رد: { success:true, data: { status: 'ok' } }

- GET /api/test
  - وصف: endpoint للاختبار يحتوي بيانات عيّنة.
  - حاجة Login: لا
  - رد: sample objects

- GET /api/courses
  - وصف: استعلام قائمة الكورسات (في المشروع يعيد من DB أو [] عند خطأ).
  - حاجة Login: لا
  - query: ?q&category&level&minPrice&maxPrice&free&rating&sort&page
  - رد: { success:true, data: [ courses ] }

- GET /api/courses/:slug
  - وصف: تفاصيل كورس (slug) — يعرض محتوى عام وإشارات لمقاطع المعاينة.
  - حاجة Login: لا (بعض الحقول المحمية في الدروس)

- GET /api/categories
  - وصف: قائمة الأقسام
  - حاجة Login: لا

- GET /api/search?q=
  - وصف: بحث عام في العناوين والوصف
  - حاجة Login: لا

- POST /api/contact
  - وصف: إرسال رسالة تواصل من المستخدم العام
  - body: { name, email, subject?, message }
  - حاجة Login: لا

---

## Dashboard (مستخدم مسجّل — يتطلب توكن/جلسة)

- GET /api/dashboard/overview
  - وصف: إحصاءات ومختصر للمستخدم
  - حاجة Login: نعم

- GET /api/dashboard/courses
- GET /api/dashboard/courses/:id
- GET /api/dashboard/courses/:id/lessons/:lessonId
  - وصف: الوصول لكورسات المستخدم وتفاصيل الدروس بعد التحقق من الاشتراك
  - حاجة Login: نعم

- POST /api/dashboard/lessons/:lessonId/complete
  - وصف: تعليم الدرس كمكتمل
  - حاجة Login: نعم
  - body: none

- PATCH /api/dashboard/lessons/:lessonId/progress
  - وصف: تحديث تقدم المشاهدة (watched_seconds أو progress)
  - حاجة Login: نعم
  - body: { watched_seconds }

- GET /api/dashboard/progress
  - وصف: حالة التقدّم لكل الكورسات
  - حاجة Login: نعم

- GET/POST /api/dashboard/certificates
- GET/PATCH /api/dashboard/profile
- PATCH /api/dashboard/settings
- PATCH /api/dashboard/settings/password
- DELETE /api/dashboard/settings/account
  - وصف: إعدادات وملف المستخدم وشكليات الملف الشخصي
  - حاجة Login: نعم

- GET/PATCH /api/dashboard/notifications
- PATCH /api/dashboard/notifications/:id/read
- POST /api/dashboard/notifications/read-all
  - وصف: إدارة الإشعارات الخاصة بالمستخدم
  - حاجة Login: نعم

- GET/POST/DELETE /api/dashboard/wishlist
  - وصف: إضافة/حذف من قائمة الرغبات
  - حاجة Login: نعم

---

## الاشتراكات و الدفع

- POST /api/enrollments
  - وصف: تسجيل الاشتراك في كورس مجاني (أو إنشاء enrollment)
  - حاجة Login: نعم
  - body: { courseId }

- POST /api/checkout
  - وصف: بدء عملية شراء لعدة كورسات
  - حاجة Login: نعم
  - body: { courseIds: [], couponCode? }

- POST /api/coupons/validate
  - وصف: تحقق من صلاحية كود كوبون
  - حاجة Login: يمكن أن يتطلب
  - body: { code }

- GET /api/orders
- GET /api/orders/:id
  - وصف: عرض الطلبات للمستخدم
  - حاجة Login: نعم

- POST /api/webhooks/payment
  - وصف: استقبال إشعارات الدفع من بوابة الدفع (server-to-server)
  - حاجة Login: لا (يجب التحقق من التوقيع/HMAC)
  - body: depends on gateway

---

## Admin (يتطلب دور ADMIN)

- GET /api/admin/stats
  - وصف: إحصاءات عامة للـ admin
  - حاجة Login: نعم + دور ADMIN

- GET/POST /api/admin/courses
- GET/PATCH/DELETE /api/admin/courses/:id
- PATCH /api/admin/courses/:id/status
  - وصف: إدارة الكورسات (إنشاء/تعديل/حذف/تغيير الحالة)
  - حاجة Login: ADMIN

- POST /api/admin/courses/:id/sections
- PATCH /api/admin/courses/:id/sections/reorder
- PATCH/DELETE /api/admin/sections/:sectionId
- POST /api/admin/sections/:sectionId/lessons
- PATCH /api/admin/sections/:sectionId/lessons/reorder
- PATCH/DELETE /api/admin/lessons/:lessonId
- POST /api/admin/lessons/:lessonId/attachments
- DELETE /api/admin/attachments/:attachmentId
  - وصف: إدارة بنية الكورس (sections, lessons, attachments)
  - حاجة Login: ADMIN

- GET/POST /api/admin/users
- GET/DELETE /api/admin/users/:id
- PATCH /api/admin/users/:id/role
- PATCH /api/admin/users/:id/status
  - وصف: إدارة المستخدمين وصلاحياتهم
  - حاجة Login: ADMIN

- GET/POST /api/admin/categories
- PATCH/DELETE /api/admin/categories/:id
  - وصف: إدارة الأقسام
  - حاجة Login: ADMIN

- GET /api/admin/orders
- GET /api/admin/orders/:id
- PATCH /api/admin/orders/:id/status
  - وصف: إدارة الطلبات ورفع الحالات
  - حاجة Login: ADMIN

- GET/POST /api/admin/coupons
- PATCH/DELETE /api/admin/coupons/:id
  - وصف: إدارة الكوبونات
  - حاجة Login: ADMIN

- GET /api/admin/reviews
- PATCH/DELETE /api/admin/reviews/:id/approve
- DELETE /api/admin/reviews/:id
  - وصف: إدارة المراجعات والرسائل
  - حاجة Login: ADMIN

- GET/PUT /api/admin/settings
  - وصف: إعدادات التطبيق من واجهة الادمن
  - حاجة Login: ADMIN

---

## نماذج رد/خطأ مختصر

- نجاح عام:
  - { "success": true, "data": {...} }

- خطأ/فشل:
  - { "success": false, "error": { "code":"BAD_REQUEST", "message":"..." } }

---

إذا تريد، أقدر أوفّر نسخة أكثر تفصيلاً لكل endpoint تتضمن أمثلة `curl`, schema للجسم (`JSON schema`) وقيم الاستجابة التفصيلية لكل حالة خطأ.
