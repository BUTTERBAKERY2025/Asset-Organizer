// Predefined warning templates and reason categories.
// Used by the HR Warnings page and the public signing view.

export type WarningTemplate = {
  id: string;
  label: string;
  defaultLevel: "verbal" | "written_1" | "written_2" | "written_3" | "final" | "termination";
  defaultReasonCategory: string;
  body: string; // Body text shown in the formal warning document. Supports {name} and {date} placeholders.
};

export type WarningReasonCategory = {
  id: string;
  label: string;
};

export const WARNING_REASON_CATEGORIES: WarningReasonCategory[] = [
  { id: "late_repeated", label: "تكرار التأخير عن مواعيد العمل" },
  { id: "absence_unexcused", label: "غياب بدون إذن أو عذر مقبول" },
  { id: "non_compliance_instructions", label: "عدم الالتزام بتعليمات الإدارة" },
  { id: "non_compliance_uniform", label: "عدم الالتزام بالزي الرسمي والمظهر" },
  { id: "non_compliance_hygiene", label: "الإخلال بالنظافة وقواعد السلامة الغذائية" },
  { id: "misconduct_customer", label: "سوء التعامل مع العملاء" },
  { id: "misconduct_colleagues", label: "الخلاف وسوء التعامل مع الزملاء" },
  { id: "negligence_duties", label: "الإهمال في أداء الواجبات الوظيفية" },
  { id: "damage_property", label: "إتلاف أو إساءة استخدام ممتلكات المنشأة" },
  { id: "leaving_post", label: "ترك موقع العمل أثناء ساعات الدوام" },
  { id: "phone_use", label: "الانشغال بالهاتف الشخصي أثناء العمل" },
  { id: "false_reporting", label: "تقديم بيانات أو تقارير غير صحيحة" },
  { id: "other", label: "سبب آخر (يُكتب يدويًا)" },
];

export const WARNING_TEMPLATES: WarningTemplate[] = [
  {
    id: "notice_attention",
    label: "لفت نظر",
    defaultLevel: "verbal",
    defaultReasonCategory: "non_compliance_instructions",
    body: `الأخ / الأخت {name} المحترم/ـة،

نلفت نظركم بشأن المخالفة الموضّحة أدناه، ونأمل الالتزام بتعليمات العمل وضوابط المنشأة مستقبلًا، تفاديًا لاتخاذ إجراءات تأديبية أكثر صرامة وفقًا للائحة تنظيم العمل المعتمدة ونظام العمل السعودي.

نأمل منكم تحسين الأداء والالتزام، ونؤكد أن استمرار المخالفة سيستوجب اتخاذ ما يلزم نظامًا.

تحريرًا في: {date}`,
  },
  {
    id: "warn_late_repeated",
    label: "إنذار — تكرار التأخير",
    defaultLevel: "written_1",
    defaultReasonCategory: "late_repeated",
    body: `الأخ / الأخت {name} المحترم/ـة،

نظرًا لتكرار تأخركم عن مواعيد العمل المحددة على الرغم من التنبيه السابق، فإن المنشأة توجّه إليكم هذا الإنذار الكتابي وفقًا لما تقضي به المادة (80) من نظام العمل السعودي ولائحة الجزاءات المعتمدة.

نأمل الالتزام بمواعيد الحضور والانصراف، وتفادي تكرار المخالفة، علمًا بأن تكرارها سيستوجب توقيع جزاء مالي وتصعيد الإجراء التأديبي وفقًا للائحة.

تحريرًا في: {date}`,
  },
  {
    id: "warn_absence",
    label: "إنذار — الغياب بدون عذر",
    defaultLevel: "written_1",
    defaultReasonCategory: "absence_unexcused",
    body: `الأخ / الأخت {name} المحترم/ـة،

نفيدكم بأنه قد تم رصد غيابكم عن العمل دون تقديم عذر مقبول أو إشعار مسبق للإدارة، وهو ما يُعدّ مخالفة صريحة لأحكام نظام العمل السعودي وللائحة الجزاءات المعتمدة لدى المنشأة.

عليه، توجّه إليكم المنشأة هذا الإنذار الكتابي، مع التنبيه إلى أن تكرار الغياب دون عذر مقبول قد يستوجب تطبيق الجزاءات المقررة بما فيها الحسم من الراتب وفسخ عقد العمل وفقًا للمادة (80) من النظام.

تحريرًا في: {date}`,
  },
  {
    id: "warn_uniform_hygiene",
    label: "إنذار — الزي والنظافة الشخصية",
    defaultLevel: "written_1",
    defaultReasonCategory: "non_compliance_uniform",
    body: `الأخ / الأخت {name} المحترم/ـة،

لاحظت الإدارة عدم التزامكم بالزي الرسمي المعتمد و/أو معايير النظافة الشخصية المطلوبة، مما يخالف ضوابط العمل في قطاع الأغذية ولائحة المنشأة.

نوجّه إليكم هذا الإنذار، ونؤكد ضرورة الالتزام التام مستقبلًا، حفاظًا على سمعة المنشأة وسلامة المنتج والعميل.

تحريرًا في: {date}`,
  },
  {
    id: "warn_customer_misconduct",
    label: "إنذار — سوء التعامل مع العملاء",
    defaultLevel: "written_2",
    defaultReasonCategory: "misconduct_customer",
    body: `الأخ / الأخت {name} المحترم/ـة،

ورد إلى الإدارة بلاغ موثّق بشأن سوء تعاملكم مع أحد العملاء على النحو المبيّن في تفاصيل الإنذار. وحيث إن خدمة العميل من أولويات المنشأة، فإن هذا السلوك يُعدّ مخالفة جسيمة تستوجب توجيه إنذار كتابي مشدّد.

عليه، فأنتم مكلَّفون بالالتزام بآداب المهنة وحسن التعامل، علمًا بأن تكرار المخالفة سيستوجب تصعيد الإجراء بما فيه الفصل التأديبي وفقًا للائحة.

تحريرًا في: {date}`,
  },
  {
    id: "warn_negligence",
    label: "إنذار — الإهمال في العمل",
    defaultLevel: "written_2",
    defaultReasonCategory: "negligence_duties",
    body: `الأخ / الأخت {name} المحترم/ـة،

تبيّن للإدارة وجود إهمال واضح في أداء واجباتكم الوظيفية على النحو الموثّق أدناه، الأمر الذي ترتّب عليه إخلال بسير العمل وتأثير على جودة الخدمة.

عليه، فقد قرّرت المنشأة توجيه هذا الإنذار الكتابي إليكم، مع التأكيد على ضرورة الالتزام التام بمهام الوظيفة، وأن استمرار الإهمال سيستوجب تطبيق الجزاءات الواردة في لائحة الجزاءات المعتمدة.

تحريرًا في: {date}`,
  },
  {
    id: "warn_damage_property",
    label: "إنذار — إتلاف ممتلكات",
    defaultLevel: "written_2",
    defaultReasonCategory: "damage_property",
    body: `الأخ / الأخت {name} المحترم/ـة،

تبيّن للإدارة قيامكم بإتلاف أو سوء استخدام إحدى ممتلكات المنشأة على النحو المبيّن في تفاصيل الإنذار، وهو ما يخالف لائحة العمل المعتمدة ويُرتّب مسؤولية مالية.

عليه، تُوجّه إليكم المنشأة هذا الإنذار الكتابي مع تحميلكم قيمة الضرر وفقًا للائحة الجزاءات، وحفظ حق المنشأة في اتخاذ ما يلزم نظامًا.

تحريرًا في: {date}`,
  },
  {
    id: "warn_final",
    label: "إنذار نهائي قبل الفصل",
    defaultLevel: "final",
    defaultReasonCategory: "non_compliance_instructions",
    body: `الأخ / الأخت {name} المحترم/ـة،

نظرًا لتكرار المخالفات السابقة وعدم استجابتكم للإنذارات الموجّهة إليكم، فإن المنشأة توجّه إليكم هذا الإنذار النهائي وفقًا لأحكام نظام العمل السعودي ولائحة الجزاءات المعتمدة.

نُنبّهكم إلى أن تكرار المخالفة بعد هذا الإنذار سيستوجب فسخ عقد العمل دون إشعار ودون مكافأة وفقًا للمادة (80) من نظام العمل، مع حفظ كافة حقوق المنشأة.

تحريرًا في: {date}`,
  },
];

// Standard legal footer shown to the employee on the public signing page
// and on the printed PDF document.
export const WARNING_LEGAL_NOTICE = `أُصدر هذا الإنذار وفقًا لأحكام نظام العمل السعودي الصادر بالمرسوم الملكي رقم (م/51) وتاريخ 23/8/1426هـ ولائحة الجزاءات المعتمدة لدى المنشأة. ويحقّ للموظف الاعتراض على ما ورد فيه خلال خمسة عشر يومًا من تاريخ توقيعه عبر التواصل الرسمي مع إدارة الموارد البشرية، وفقًا لما تنصّ عليه المادة (71) من النظام. ويُعدّ توقيع الموظف أدناه إقرارًا منه باستلام الإنذار والاطلاع على مضمونه دون أن يعني ذلك بالضرورة موافقته على ما ورد فيه.`;

export function getWarningTemplate(id?: string | null): WarningTemplate | undefined {
  if (!id) return undefined;
  return WARNING_TEMPLATES.find((t) => t.id === id);
}

export function getWarningReasonCategory(id?: string | null): WarningReasonCategory | undefined {
  if (!id) return undefined;
  return WARNING_REASON_CATEGORIES.find((c) => c.id === id);
}

export function renderWarningBody(
  body: string,
  vars: { name?: string | null; date?: string | null },
): string {
  return body
    .replace(/\{name\}/g, vars.name || "—")
    .replace(/\{date\}/g, vars.date || "—");
}
