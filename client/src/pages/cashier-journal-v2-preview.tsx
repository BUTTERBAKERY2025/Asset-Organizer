import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import {
  StepIndicator,
  ShiftInfoCard,
  SalesTotalsHero,
  PaymentTabs,
  ReturnsAndNotes,
  AttachmentsGrid,
  SummaryDashboard,
  StickyFooter,
  CARD_NETWORKS,
  DELIVERY_COMPANIES,
  type CardRow,
  type DeliveryRow,
  type CreditRow,
  type AttachmentItem,
  type DifferenceItem,
  type ChannelStatus,
} from "@/components/cashier-journal-v2";
import type { AttachmentType } from "@shared/schema";

export default function CashierJournalV2PreviewPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [branchId, setBranchId] = useState("1");
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split("T")[0]);
  const [shiftType, setShiftType] = useState("morning");
  const cashierName = "ADELS";

  const [totalSales, setTotalSales] = useState(5127.5);
  const [invoiceCount, setInvoiceCount] = useState(78);
  const [openingBalance, setOpeningBalance] = useState(500);

  const [cashPos, setCashPos] = useState(1640);
  const [cashActual, setCashActual] = useState(1630);

  const [cardRows, setCardRows] = useState<CardRow[]>(
    CARD_NETWORKS.map((n) => ({
      method: n.method,
      label: n.label,
      pos: n.method === "mada" ? 650 : n.method === "visa" ? 425 : 172,
      actual: n.method === "mada" ? 650 : n.method === "visa" ? 427.5 : 0,
    })),
  );

  const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>(
    DELIVERY_COMPANIES.map((c) => ({
      method: c.method,
      label: c.label,
      latin: c.latin,
      orders: c.method === "jahez" ? 12 : c.method === "hunger_station" ? 8 : c.method === "toyou" ? 5 : c.method === "keeta" ? 10 : 0,
      amount: c.method === "jahez" ? 980 : c.method === "hunger_station" ? 640 : c.method === "toyou" ? 420 : c.method === "keeta" ? 800 : 0,
      commissionPct: c.defaultCommission,
    })),
  );

  const [creditRows, setCreditRows] = useState<CreditRow[]>([
    { customer: "عميل عقد", amount: 255 },
  ]);

  const [hasReturn, setHasReturn] = useState(false);
  const [returnAmount, setReturnAmount] = useState(0);
  const [returnReason, setReturnReason] = useState("");
  const [returnReference, setReturnReference] = useState("");
  const [notes, setNotes] = useState("");

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading] = useState<Set<AttachmentType>>(new Set());

  const netSales = totalSales - (hasReturn ? returnAmount : 0);

  const channelStatuses: {
    cash: ChannelStatus;
    cards: ChannelStatus;
    delivery: ChannelStatus;
    credit: ChannelStatus;
  } = useMemo(() => {
    const cardsActual = cardRows.reduce((s, r) => s + r.actual, 0);
    const cardsPos = cardRows.reduce((s, r) => s + r.pos, 0);
    const cardsDiff = cardsActual - cardsPos;
    const deliveryAmount = deliveryRows.reduce((s, r) => s + r.amount * (1 - r.commissionPct / 100), 0);
    const deliveryActiveCount = deliveryRows.filter((r) => r.amount > 0).length;
    const creditAmount = creditRows.reduce((s, r) => s + r.amount, 0);
    const cashDiff = cashActual - cashPos;

    return {
      cash: {
        amount: cashActual,
        status: cashActual === 0 && cashPos === 0 ? "empty" : Math.abs(cashDiff) < 0.01 ? "matched" : "diff",
        diffLabel: Math.abs(cashDiff) >= 0.01 ? `${cashDiff > 0 ? "+" : ""}${cashDiff.toFixed(2)}` : undefined,
      },
      cards: {
        amount: cardsActual,
        status: cardsActual === 0 ? "empty" : Math.abs(cardsDiff) < 0.01 ? "matched" : "diff",
        diffLabel: Math.abs(cardsDiff) >= 0.01 ? `${cardsDiff > 0 ? "+" : ""}${cardsDiff.toFixed(2)}` : undefined,
      },
      delivery: {
        amount: deliveryAmount,
        status: deliveryAmount === 0 ? "empty" : "context",
        contextLabel: deliveryActiveCount > 0 ? `${deliveryActiveCount} شركات` : undefined,
      },
      credit: {
        amount: creditAmount,
        status: creditAmount === 0 ? "empty" : "context",
        contextLabel: creditRows.length > 0 ? `${creditRows.length} مدين` : undefined,
      },
    };
  }, [cashActual, cashPos, cardRows, deliveryRows, creditRows]);

  const collectedTotal =
    channelStatuses.cash.amount +
    channelStatuses.cards.amount +
    channelStatuses.delivery.amount +
    channelStatuses.credit.amount;
  const netDifference = collectedTotal - netSales;
  const channelsUsed = [
    channelStatuses.cash.amount,
    channelStatuses.cards.amount,
    channelStatuses.delivery.amount,
    channelStatuses.credit.amount,
  ].filter((v) => v > 0).length;

  const differences: DifferenceItem[] = useMemo(() => {
    const items: DifferenceItem[] = [];
    if (Math.abs(cashActual - cashPos) > 0.01) {
      const diff = cashActual - cashPos;
      items.push({
        key: "cash",
        source: "النقد",
        descriptor: "POS مقابل الصندوق",
        posLabel: `المسجل ${cashPos.toFixed(2)}`,
        actualLabel: `الفعلي ${cashActual.toFixed(2)}`,
        posValue: cashPos,
        actualValue: cashActual,
        diff,
        status: "unjustified",
      });
    }
    cardRows.forEach((r) => {
      if (r.actual > 0 && Math.abs(r.actual - r.pos) > 0.01) {
        items.push({
          key: `card-${r.method}`,
          source: r.label,
          descriptor: "POS مقابل التقرير",
          posLabel: `المسجل ${r.pos.toFixed(2)}`,
          actualLabel: `الفعلي ${r.actual.toFixed(2)}`,
          posValue: r.pos,
          actualValue: r.actual,
          diff: r.actual - r.pos,
          status: "justified",
        });
      } else if (r.pos > 0 && r.actual === 0) {
        items.push({
          key: `card-${r.method}-pending`,
          source: r.label,
          descriptor: "لم يُدخل الفعلي",
          posLabel: `المسجل ${r.pos.toFixed(2)}`,
          actualLabel: "الفعلي —",
          posValue: r.pos,
          actualValue: null,
          diff: null,
          status: "pending",
        });
      }
    });
    return items;
  }, [cashPos, cashActual, cardRows]);

  const handleUpload = (type: AttachmentType, file: File) => {
    const url = URL.createObjectURL(file);
    setAttachments((prev) => [
      ...prev,
      {
        attachmentType: type,
        fileName: file.name,
        downloadUrl: url,
        mimeType: file.type,
      },
    ]);
  };

  const handleRemoveAttachment = (att: AttachmentItem) => {
    setAttachments((prev) => prev.filter((a) => a !== att));
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1200px] space-y-4 p-4 pb-24" dir="rtl">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>وضع المعاينة</strong> — هذه صفحة لاختبار التصميم الجديد لنموذج يومية الكاشير. البيانات وهمية ولا تُحفظ.
        </div>

        <StepIndicator activeStep={step} onStepClick={setStep} />

        <ShiftInfoCard
          branchId={branchId}
          branches={[
            { id: "1", name: "فرع الرياض" },
            { id: "2", name: "فرع جدة" },
            { id: "3", name: "فرع الدمام" },
          ]}
          onBranchChange={setBranchId}
          journalDate={journalDate}
          onDateChange={setJournalDate}
          shiftType={shiftType}
          onShiftChange={setShiftType}
          cashierName={cashierName}
        />

        <SalesTotalsHero
          totalSales={totalSales}
          onTotalSalesChange={setTotalSales}
          invoiceCount={invoiceCount}
          onInvoiceCountChange={setInvoiceCount}
          openingBalance={openingBalance}
          onOpeningBalanceChange={setOpeningBalance}
        />

        <PaymentTabs
          cashPos={cashPos}
          cashActual={cashActual}
          onCashPosChange={setCashPos}
          onCashActualChange={setCashActual}
          cardRows={cardRows}
          onCardRowsChange={setCardRows}
          deliveryRows={deliveryRows}
          onDeliveryRowsChange={setDeliveryRows}
          creditRows={creditRows}
          onCreditRowsChange={setCreditRows}
        />

        <ReturnsAndNotes
          hasReturn={hasReturn}
          returnAmount={returnAmount}
          returnReason={returnReason}
          returnReference={returnReference}
          onToggleReturn={setHasReturn}
          onReturnAmountChange={setReturnAmount}
          onReturnReasonChange={setReturnReason}
          onReturnReferenceChange={setReturnReference}
          notes={notes}
          onNotesChange={setNotes}
        />

        <AttachmentsGrid
          attachments={attachments}
          uploading={uploading}
          onUpload={handleUpload}
          onRemove={handleRemoveAttachment}
        />

        <SummaryDashboard
          branchName="فرع الرياض"
          shiftLabel="الوردية الصباحية"
          dateLabel={new Date(journalDate).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
          cashierName={cashierName}
          status="submitted"
          totalSales={netSales}
          invoiceCount={invoiceCount}
          avgInvoice={invoiceCount > 0 ? netSales / invoiceCount : 0}
          collectedTotal={collectedTotal}
          channelsUsed={channelsUsed}
          openingBalance={openingBalance}
          netDifference={netDifference}
          channels={channelStatuses}
          differences={differences}
        />

        <StickyFooter
          totalSales={netSales}
          collectedTotal={collectedTotal}
          netDifference={netDifference}
          signatureMissing={true}
          onPrint={() => alert("طباعة الملخص — معاينة فقط")}
          onSaveDraft={() => alert("حفظ كمسودة — معاينة فقط")}
          onSignAndFinalize={() => alert("توقيع وإنهاء — معاينة فقط")}
        />
      </div>
    </Layout>
  );
}
