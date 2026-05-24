import { forwardRef } from "react";
import { WARNING_LEVEL_LABELS } from "@shared/schema";

// Official company identity — single source of truth for the disciplinary
// document. Kept inline here (rather than imported from a settings store)
// so the printed PDF is fully self-contained and never falls back to a
// generic label if a remote config fails to load.
export const COMPANY_NAME_AR = "شركة الزبد الأفضل التجارية";
export const COMPANY_CR_NUMBER = "7026155296";
export const COMPANY_LOGO_URL = "/company-logo.png";

export type WarningDocumentProps = {
  companyName?: string;
  companyCrNumber?: string;
  companyLogoUrl?: string;
  branchName?: string | null;
  warning: {
    id: number;
    level: string;
    reason: string;
    description?: string | null;
    issuedDate: string;
    deductionAmount?: number | null;
    signedAt?: string | Date | null;
    signatureData?: string | null;
  };
  employee: {
    employeeName?: string | null;
    jobTitle?: string | null;
    nationalId?: string | null;
  } | null;
  templateBody?: string | null;
  reasonCategoryLabel?: string | null;
  legalNotice: string;
};

export const WarningDocument = forwardRef<HTMLDivElement, WarningDocumentProps>(function WarningDocument(
  {
    companyName = COMPANY_NAME_AR,
    companyCrNumber = COMPANY_CR_NUMBER,
    companyLogoUrl = COMPANY_LOGO_URL,
    branchName,
    warning,
    employee,
    templateBody,
    reasonCategoryLabel,
    legalNotice,
  },
  ref,
) {
  const fmtMoney = (n?: number | null) =>
    Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d?: string | Date | null) => {
    if (!d) return "—";
    try {
      const dt = typeof d === "string" ? new Date(d) : d;
      return dt.toLocaleString("ar-SA-u-nu-latn", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return String(d);
    }
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      lang="ar"
      style={{
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "18mm 16mm",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Cairo', 'Tajawal', system-ui, sans-serif",
        fontSize: "13px",
        lineHeight: 1.85,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
      data-testid="warning-document"
    >
      {/* Watermark — printed at low opacity behind all content. position:absolute
          inside a position:relative parent (the outer wrapper below has it). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: 0.06,
          zIndex: 0,
        }}
      >
        <img
          src={companyLogoUrl}
          alt=""
          style={{ width: "140mm", height: "auto", objectFit: "contain" }}
          // Watermark should never block printing if it fails to load.
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* All real content sits above the watermark via z-index. */}
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #b45309", paddingBottom: "8mm", marginBottom: "8mm" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4mm", flex: 1 }}>
            <img
              src={companyLogoUrl}
              alt={companyName}
              style={{ width: "22mm", height: "22mm", objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#b45309", lineHeight: 1.2 }}>{companyName}</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                سجل تجاري: <span style={{ direction: "ltr", display: "inline-block" }}>{companyCrNumber}</span>
              </div>
              {branchName && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>فرع: {branchName}</div>}
            </div>
          </div>
          <div style={{ textAlign: "left" as const, fontSize: "11px", color: "#64748b" }}>
            <div>المرجع: <span style={{ direction: "ltr", display: "inline-block" }}>WRN-{String(warning.id).padStart(6, "0")}</span></div>
            <div>التاريخ: {warning.issuedDate}</div>
          </div>
        </div>
        <h1 style={{ textAlign: "center" as const, fontSize: "22px", fontWeight: 800, margin: "8mm 0 0" }}>
          {WARNING_LEVEL_LABELS[warning.level] || warning.level}
        </h1>
      </div>

      {/* Employee block */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6mm", fontSize: "12px" }}>
        <tbody>
          <tr>
            <td style={cellLabel}>اسم الموظف</td>
            <td style={cellValue}>{employee?.employeeName || "—"}</td>
            <td style={cellLabel}>المسمى الوظيفي</td>
            <td style={cellValue}>{employee?.jobTitle || "—"}</td>
          </tr>
          <tr>
            <td style={cellLabel}>رقم الهوية</td>
            <td style={cellValue}>{employee?.nationalId || "—"}</td>
            <td style={cellLabel}>الفرع</td>
            <td style={cellValue}>{branchName || "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Subject */}
      <div style={{ marginBottom: "5mm" }}>
        <div style={sectionTitle}>الموضوع</div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>{warning.reason}</div>
        {reasonCategoryLabel && (
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1mm" }}>
            تصنيف المخالفة: {reasonCategoryLabel}
          </div>
        )}
      </div>

      {/* Template body */}
      {templateBody && (
        <div style={{ marginBottom: "5mm" }}>
          <div style={sectionTitle}>نص الإنذار</div>
          <div style={{ whiteSpace: "pre-line", fontSize: "13px", lineHeight: 2 }}>{templateBody}</div>
        </div>
      )}

      {/* Description / details */}
      {warning.description && (
        <div style={{ marginBottom: "5mm" }}>
          <div style={sectionTitle}>تفاصيل المخالفة</div>
          <div style={{ whiteSpace: "pre-line" }}>{warning.description}</div>
        </div>
      )}

      {/* Financial penalty */}
      {warning.deductionAmount && warning.deductionAmount > 0 ? (
        <div style={{
          marginBottom: "5mm",
          padding: "3mm 4mm",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "2mm",
        }}>
          <strong>الجزاء المالي:</strong> سيتم خصم مبلغ{" "}
          <span style={{ fontWeight: 800, color: "#b91c1c" }}>{fmtMoney(warning.deductionAmount)} ريال سعودي</span>{" "}
          من راتب الموظف عن الشهر الحالي وفقًا للائحة الجزاءات المعتمدة.
        </div>
      ) : null}

      {/* Legal */}
      <div style={{ marginBottom: "8mm" }}>
        <div style={sectionTitle}>النص النظامي</div>
        <div style={{ fontSize: "11px", color: "#334155", lineHeight: 1.8, textAlign: "justify" as const }}>
          {legalNotice}
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm", marginTop: "12mm" }}>
        <div>
          <div style={signLabel}>توقيع المسؤول / المدير</div>
          <div style={signBox} />
          <div style={signMeta}>{companyName}</div>
        </div>
        <div>
          <div style={signLabel}>توقيع الموظف</div>
          {warning.signatureData ? (
            <div style={{ ...signBox, position: "relative" as const }}>
              <img
                src={warning.signatureData}
                alt="توقيع الموظف"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div style={signBox} />
          )}
          <div style={signMeta}>
            {warning.signedAt ? `تم التوقيع إلكترونيًا في: ${fmtDate(warning.signedAt)}` : "بانتظار توقيع الموظف"}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "10mm", paddingTop: "4mm", borderTop: "1px solid #e2e8f0", fontSize: "10px", color: "#94a3b8", textAlign: "center" as const }}>
        وثيقة رسمية صادرة من {companyName} (سجل تجاري <span style={{ direction: "ltr", display: "inline-block" }}>{companyCrNumber}</span>) — لأي استفسار يُرجى التواصل مع إدارة الموارد البشرية.
      </div>
      </div>{/* /content wrapper above watermark */}
    </div>
  );
});

const cellLabel: React.CSSProperties = {
  background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2mm 3mm",
  fontWeight: 600, color: "#475569", width: "22%",
};
const cellValue: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "2mm 3mm", width: "28%",
};
const sectionTitle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#b45309",
  borderInlineStart: "3px solid #b45309", paddingInlineStart: "3mm", marginBottom: "2mm",
};
const signLabel: React.CSSProperties = { fontSize: "11px", color: "#64748b", marginBottom: "2mm" };
const signBox: React.CSSProperties = {
  height: "30mm", border: "1px dashed #cbd5e1", borderRadius: "1.5mm",
  display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa",
};
const signMeta: React.CSSProperties = { fontSize: "10px", color: "#64748b", marginTop: "2mm", textAlign: "center" as const };
