import { forwardRef } from "react";
import type { ConstructionContract, Contractor, ContractMilestone, ContractItem, ConstructionProject } from "@shared/schema";

interface Props {
  contract: ConstructionContract;
  contractor?: Contractor;
  project?: ConstructionProject;
  milestones?: ContractMilestone[];
  boqItems?: ContractItem[];
}

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn", { style: "currency", currency: "SAR" }).format(n || 0);

const todayAr = (d?: string | null) => d || new Date().toISOString().slice(0, 10);

export const ContractDocument = forwardRef<HTMLDivElement, Props>(
  ({ contract, contractor, project, milestones = [], boqItems = [] }, ref) => {
    const firstParty = contract.firstPartyName || "شركة باتر بيكري";
    const firstRep = contract.firstPartyRepresentative || "________________________";
    const firstTitle = contract.firstPartyTitle || "المدير التنفيذي";
    const firstId = contract.firstPartyIdNumber || "________________________";
    const sigDate = todayAr(contract.signatureDate);
    const sigLoc = contract.signatureLocation || "الرياض، المملكة العربية السعودية";
    const totalItems = boqItems.filter((i) => !i.isSection);

    return (
      <div ref={ref} className="bg-white text-black p-12 font-[Cairo] leading-relaxed" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif', minHeight: '297mm', width: '210mm', margin: '0 auto' }}>
        {/* Header */}
        <div className="text-center border-b-4 border-amber-700 pb-4 mb-6">
          <div className="text-2xl font-bold text-amber-800">شركة باتر بيكري — Butter Bakery</div>
          <div className="text-sm text-gray-600 mt-1">المملكة العربية السعودية</div>
          <h1 className="text-3xl font-extrabold mt-4">عقد مقاولة إنشائية</h1>
          <div className="text-base mt-1 text-gray-700">رقم العقد: <span className="font-mono font-bold">{contract.contractNumber || `#${contract.id}`}</span></div>
        </div>

        {/* Preamble */}
        <p className="text-sm leading-loose mb-4">
          إنه في يوم <strong>{sigDate}</strong> بمدينة <strong>{sigLoc}</strong>، تم الاتفاق بين كل من:
        </p>

        {/* Parties */}
        <div className="border border-gray-300 rounded-lg p-4 mb-3 bg-amber-50">
          <div className="font-bold text-amber-900 mb-2">الطرف الأول (صاحب العمل):</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">الاسم:</span> {firstParty}</div>
            <div><span className="font-semibold">السجل التجاري / الهوية:</span> {firstId}</div>
            <div><span className="font-semibold">يمثله:</span> {firstRep}</div>
            <div><span className="font-semibold">المنصب:</span> {firstTitle}</div>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-4 mb-4 bg-blue-50">
          <div className="font-bold text-blue-900 mb-2">الطرف الثاني (المقاول):</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-semibold">الاسم:</span> {contractor?.name || "________________________"}</div>
            <div><span className="font-semibold">السجل التجاري / الهوية:</span> {(contractor as any)?.commercialRegister || (contractor as any)?.idNumber || "________________________"}</div>
            <div><span className="font-semibold">جهة الاتصال:</span> {contractor?.phone || "________________________"}</div>
            <div><span className="font-semibold">البريد الإلكتروني:</span> {(contractor as any)?.email || "________________________"}</div>
          </div>
        </div>

        <p className="text-sm leading-loose mb-4">
          ولرغبة الطرف الأول في تنفيذ الأعمال المبينة أدناه، وحيث أن الطرف الثاني يقبل بتنفيذها، فقد اتفق الطرفان وهما بكامل الأهلية المعتبرة شرعاً ونظاماً على ما يلي:
        </p>

        {/* Article 1: Subject */}
        <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الأولى: موضوع العقد</h2>
        <p className="text-sm leading-loose mb-2">
          يلتزم الطرف الثاني بتنفيذ <strong>"{contract.title}"</strong>
          {project ? <> ضمن مشروع <strong>"{project.title}"</strong></> : null}
          {contract.workLocation ? <> الكائن في <strong>{contract.workLocation}</strong></> : null}
          ، وفقاً للمواصفات والشروط الواردة في هذا العقد وملاحقه.
        </p>
        {contract.scopeOfWork && (
          <div className="text-sm bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap mt-2">
            <div className="font-semibold mb-1">نطاق الأعمال التفصيلي:</div>
            {contract.scopeOfWork}
          </div>
        )}

        {/* Article 2: Value */}
        <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الثانية: قيمة العقد</h2>
        <p className="text-sm leading-loose mb-2">
          اتفق الطرفان على أن قيمة هذا العقد الإجمالية هي <strong className="text-amber-900">{fmt(contract.totalAmount)}</strong>
          {" "}({contract.contractType === 'fixed_price' ? 'سعر مقطوع' : contract.contractType === 'unit_price' ? 'سعر وحدة' : contract.contractType})، شاملة كافة المصاريف والضرائب وضريبة القيمة المضافة.
        </p>

        {/* Article 3: Duration */}
        <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الثالثة: مدة التنفيذ</h2>
        <p className="text-sm leading-loose">
          يلتزم الطرف الثاني بتنفيذ الأعمال خلال مدة قدرها <strong>{contract.executionDuration || "________________________"}</strong>
          {contract.startDate && <> تبدأ من تاريخ <strong>{contract.startDate}</strong></>}
          {contract.endDate && <> وتنتهي في <strong>{contract.endDate}</strong></>}
          .
          {contract.plannedCompletionDate && <> التاريخ المخطط للإنجاز: <strong>{contract.plannedCompletionDate}</strong>.</>}
        </p>

        {/* Article 4: Payments / Milestones */}
        {milestones.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الرابعة: شروط الدفع ومراحل الصرف</h2>
            <table className="w-full text-xs border border-gray-300 mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1.5 w-10">#</th>
                  <th className="border p-1.5">المرحلة</th>
                  <th className="border p-1.5 w-24">القيمة</th>
                  <th className="border p-1.5 w-20">النسبة</th>
                  <th className="border p-1.5 w-28">تاريخ الاستحقاق</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <td className="border p-1.5 text-center">{m.sequence}</td>
                    <td className="border p-1.5">{m.title}</td>
                    <td className="border p-1.5 text-center">{fmt(m.amount)}</td>
                    <td className="border p-1.5 text-center">{m.percentage ? `${m.percentage}%` : '-'}</td>
                    <td className="border p-1.5 text-center">{m.dueDate || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Article 5: BOQ */}
        {totalItems.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الخامسة: جدول الكميات</h2>
            <table className="w-full text-xs border border-gray-300 mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-1.5 w-12">#</th>
                  <th className="border p-1.5">الوصف</th>
                  <th className="border p-1.5 w-16">الوحدة</th>
                  <th className="border p-1.5 w-16">الكمية</th>
                  <th className="border p-1.5 w-24">سعر الوحدة</th>
                  <th className="border p-1.5 w-28">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {boqItems.map((it) => (
                  <tr key={it.id} className={it.isSection ? "bg-amber-50 font-bold" : ""}>
                    <td className="border p-1.5 text-center font-mono">{it.itemNumber || ''}</td>
                    <td className="border p-1.5">{it.description}</td>
                    <td className="border p-1.5 text-center">{it.isSection ? '' : it.unit}</td>
                    <td className="border p-1.5 text-center">{it.isSection ? '' : it.quantity}</td>
                    <td className="border p-1.5 text-center">{it.isSection ? '' : fmt(it.unitPrice)}</td>
                    <td className="border p-1.5 text-center">{it.isSection ? '' : fmt(it.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Article 6: Retention */}
        {(contract.retentionPercentage || 0) > 0 && (
          <>
            <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة السادسة: ضمان حسن التنفيذ (الضمان المحتجز)</h2>
            <p className="text-sm leading-loose">
              يحتجز الطرف الأول نسبة <strong>{contract.retentionPercentage}%</strong> من قيمة كل دفعة كضمان لحسن التنفيذ، يُفرج عنها
              {contract.retentionReleaseDate ? <> في تاريخ <strong>{contract.retentionReleaseDate}</strong></> : <> بعد انقضاء فترة الضمان</>}
              {contract.warrantyPeriod && <> ({contract.warrantyPeriod})</>}.
            </p>
          </>
        )}

        {/* Article 7: LD */}
        {contract.ldEnabled && (
          <>
            <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة السابعة: غرامات التأخير</h2>
            <p className="text-sm leading-loose">
              في حال تأخر الطرف الثاني عن إنجاز الأعمال في الموعد المحدد، يستحق الطرف الأول غرامة تأخير قدرها
              <strong> {contract.ldDailyRate}% </strong> من قيمة العقد عن كل يوم تأخير، بحد أقصى <strong>{contract.ldMaxPercentage}%</strong> من قيمة العقد.
            </p>
          </>
        )}

        {/* Article 8: Terms */}
        {contract.termsAndConditions && (
          <>
            <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة الثامنة: الشروط والأحكام العامة</h2>
            <div className="text-sm leading-loose whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-3">
              {contract.termsAndConditions}
            </div>
          </>
        )}

        {/* Article 9: General */}
        <h2 className="text-lg font-bold text-amber-800 border-r-4 border-amber-600 pr-2 mt-5 mb-2">المادة التاسعة: أحكام عامة</h2>
        <ol className="text-sm leading-loose list-decimal mr-5 space-y-1">
          <li>يخضع هذا العقد لأنظمة المملكة العربية السعودية ولوائحها.</li>
          <li>أي خلاف ينشأ بين الطرفين يُحال إلى الجهات القضائية المختصة بمدينة الرياض.</li>
          <li>لا يجوز لأي من الطرفين التنازل عن هذا العقد للغير إلا بموافقة كتابية من الطرف الآخر.</li>
          <li>يُعتبر هذا العقد ملاحقه (إن وُجدت) جزءاً لا يتجزأ منه.</li>
          <li>حُرر هذا العقد من نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها.</li>
        </ol>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-6">
          <div className="text-center border-t-2 border-gray-400 pt-2">
            <div className="font-bold mb-2">الطرف الأول</div>
            <div className="text-sm">{firstParty}</div>
            <div className="text-xs text-gray-600 mt-1">{firstRep}</div>
            <div className="text-xs text-gray-600">{firstTitle}</div>
            <div className="mt-12 text-xs text-gray-500">التوقيع: ________________________</div>
          </div>
          <div className="text-center border-t-2 border-gray-400 pt-2">
            <div className="font-bold mb-2">الطرف الثاني</div>
            <div className="text-sm">{contractor?.name || "—"}</div>
            <div className="text-xs text-gray-600 mt-1">المقاول</div>
            <div className="text-xs text-gray-600">&nbsp;</div>
            <div className="mt-12 text-xs text-gray-500">التوقيع: ________________________</div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-8 pt-2 border-t">
          تم إنشاء هذا العقد بواسطة نظام باتر بيكري — {new Date().toLocaleDateString('ar-SA-u-nu-latn')}
        </div>
      </div>
    );
  }
);

ContractDocument.displayName = "ContractDocument";
