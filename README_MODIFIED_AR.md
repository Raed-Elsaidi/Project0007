# الملفات المعدلة

- `src/AdminLogin.jsx` — إصلاح منطق الصلاحيات وإزالة تسمية مدير المدرسة.
- `src/EmployeesManager.jsx` — إزالة مدير المدرسة من اختيار الوظائف وتحديث مدير المؤسسة.
- `src/InstitutionManagement.jsx` — استخدام «مدير المؤسسة» بدل «مدير المدرسة».
- `src/StudentSupportMessages.jsx` — إضافة البحث عن الطالب برقم الجلوس عند اختيار مستلم من نوع «طالب».
- `002_institution_manager.sql` — تحديث وظيفة مدير المؤسسة.
- `004_remove_school_manager_job.sql` — Migration لتحويل/إزالة الوظيفة القديمة بأمان مع الحفاظ على الموظفين والصلاحيات.

بعد تحديث الملفات، شغّل `004_remove_school_manager_job.sql` على قاعدة بيانات Supabase.
