import { forwardRef } from "react";
import {
  TRANSFER_BRAND,
  TRANSFER_ITEM_HEADINGS,
  formatTransferQuantity,
  mapTransferDocument,
  type TransferDocumentInput,
  type TransferDocumentItemInput,
} from "@/lib/transfer-document";

type Props = { transfer: TransferDocumentInput; items: TransferDocumentItemInput[] };

export const TransferDocument = forwardRef<HTMLDivElement, Props>(({ transfer, items }, ref) => {
  const doc = mapTransferDocument(transfer, items);
  return (
    <div ref={ref} dir="rtl" className="transfer-document relative bg-white text-[#24211d] p-5 print:p-0" style={{ fontFamily: "Tahoma, Arial, sans-serif" }}>
      <style>{`
        @media print {
          .transfer-document { width: 100%; }
          .transfer-document thead { display: table-header-group; }
          .transfer-document tr { break-inside: avoid; page-break-inside: avoid; }
          .transfer-document .doc-section { break-inside: avoid; }
        }
      `}</style>
      {doc.isUnapproved && <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-label="غير معتمد">
        <span className="-rotate-45 text-6xl font-bold text-amber-900/[0.08]">مسودة — غير معتمد</span>
      </div>}
      <header className="relative flex items-center justify-between border-b-4 pb-3" style={{ borderColor: TRANSFER_BRAND.gold }}>
        <img src={TRANSFER_BRAND.logoPath} alt="BUTTER" className="h-20 w-20 object-contain" />
        <div className="text-center">
          <div className="text-xl font-bold tracking-[0.2em]">BUTTER</div>
          <h1 className="mt-1 text-2xl font-bold">أمر تحويل مواد</h1>
        </div>
        <div className="min-w-36 text-left text-xs leading-6">
          <div><b>المرجع:</b> {doc.reference}</div>
          <div><b>الحالة:</b> {doc.statusLabel}</div>
          <div><b>التاريخ:</b> {doc.transferDate}</div>
        </div>
      </header>
      <section className="doc-section mt-4 grid grid-cols-2 gap-3">
        <div className="border p-3"><div className="text-xs text-neutral-500">جهة الإرسال</div><div className="font-bold">{doc.source}</div></div>
        <div className="border p-3"><div className="text-xs text-neutral-500">جهة الاستلام</div><div className="font-bold">{doc.destination}</div></div>
      </section>
      {(doc.driver || doc.vehicle) && <section className="doc-section mt-3 grid grid-cols-2 gap-3 bg-[#f7f3ea] p-3 text-sm">
        <div><b>السائق:</b> {doc.driver || "—"}</div><div><b>المركبة:</b> {doc.vehicle || "—"}</div>
      </section>}
      <div className="mt-5 max-w-full overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[700px] border-collapse text-xs print:min-w-0">
        <thead><tr className="bg-[#24211d] text-white">
          {["م", TRANSFER_ITEM_HEADINGS.identifier, "اسم الصنف", "الوحدة", "المتوفر", "المطلوب", TRANSFER_ITEM_HEADINGS.quantity, "المستلم", "الفرق", "ملاحظات"].map(h => <th key={h} className="border border-neutral-400 p-2">{h}</th>)}
        </tr></thead>
        <tbody>{doc.items.map((item, index) => <tr key={`${item.code}-${index}`} className={index % 2 ? "bg-[#f7f3ea]" : ""}>
          <td className="border p-2 text-center">{item.sequence}</td><td className="border p-2 text-center">{item.code}</td>
          <td className="border p-2 font-medium">{item.name}</td><td className="border p-2 text-center">{item.unit}</td>
          <td className="border p-2 text-center">{formatTransferQuantity(item.available)}</td>
          <td className="border p-2 text-center">{formatTransferQuantity(item.requested)}</td>
          <td className="border p-2 text-center">{formatTransferQuantity(item.sent)}</td>
          <td className="border p-2 text-center">{formatTransferQuantity(item.received)}</td>
          <td className="border p-2 text-center">{formatTransferQuantity(item.discrepancy)}</td>
          <td className="border p-2">{item.notes || "—"}</td>
        </tr>)}</tbody>
      </table>
      </div>
      {(doc.notes || doc.deliveryNotes) && <section className="doc-section mt-4 border-r-4 bg-[#f7f3ea] p-3 text-sm" style={{ borderColor: TRANSFER_BRAND.gold }}>
        <b>ملاحظات:</b> {[doc.notes, doc.deliveryNotes].filter(Boolean).join(" — ")}
      </section>}
      <section className="doc-section mt-8 grid grid-cols-3 gap-4">
        {([
          ["إعداد", doc.signatures.preparer],
          ["إرسال", doc.signatures.dispatcher],
          ["استلام", doc.signatures.receiver],
        ] as const).map(([label, sig]) => <div key={label} className="border-t-2 pt-2 text-center text-xs">
          <b>{label}</b><div className="mt-1">{sig.name || "الاسم: __________________"}</div>
          {sig.image ? <img src={sig.image} alt={`توقيع ${label}`} className="mx-auto mt-2 h-12 max-w-full object-contain" /> : <div className="mt-8">التوقيع: __________________</div>}
        </div>)}
      </section>
    </div>
  );
});
TransferDocument.displayName = "TransferDocument";