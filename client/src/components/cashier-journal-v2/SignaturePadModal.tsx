import { useEffect, useRef, useState } from "react";
import { X, RotateCcw, Check, PenLine } from "lucide-react";

interface SignaturePadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string, signerName: string) => void;
  defaultName?: string;
  title?: string;
  subtitle?: string;
}

export function SignaturePadModal({
  open,
  onClose,
  onConfirm,
  defaultName = "",
  title = "توقيع وإنهاء اليومية",
  subtitle = "ارسم توقيعك في المساحة أدناه. لا يمكن تعديل اليومية بعد التوقيع.",
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [signerName, setSignerName] = useState(defaultName);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSignerName(defaultName);
    setAcknowledged(false);
    setHasInk(false);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#26215C";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, 50);
  }, [open, defaultName]);

  if (!open) return null;

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    canvas.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
  };

  const handleConfirm = () => {
    if (!hasInk || !signerName.trim() || !acknowledged) return;
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    onConfirm(dataUrl, signerName.trim());
  };

  const canConfirm = hasInk && signerName.trim().length >= 2 && acknowledged;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      dir="rtl"
      data-testid="modal-signature"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-black/[0.06] p-4">
          <div className="flex items-start gap-2">
            <div className="rounded-full bg-[#EEEAFE] p-2">
              <PenLine className="h-4 w-4 text-[#534AB7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900" data-testid="text-signature-title">{title}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="button-close-signature"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">اسم الموقّع</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="الاسم الكامل"
              data-testid="input-signer-name"
              aria-label="اسم الموقّع"
              className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#534AB7] focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-600">التوقيع</label>
              <button
                type="button"
                onClick={clearPad}
                disabled={!hasInk}
                data-testid="button-clear-signature"
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#534AB7] disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" />
                مسح
              </button>
            </div>
            <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[#534AB7]/40 bg-white">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-testid="canvas-signature"
                aria-label="مساحة الرسم للتوقيع"
                className="block h-44 w-full touch-none cursor-crosshair"
                style={{ touchAction: "none" }}
              />
              {!hasInk && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-gray-300">ارسم توقيعك هنا</span>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-[#FAF7EE] p-3 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-testid="checkbox-signature-ack"
              className="mt-0.5 h-4 w-4 accent-[#534AB7]"
            />
            <span>
              أُقرّ بأن البيانات المُدخلة صحيحة ومطابقة للواقع، وأتحمّل مسؤولية أي خطأ. لن يكون بالإمكان تعديل اليومية بعد التوقيع.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/[0.06] bg-[#F1EFE8] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="button-cancel-signature"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="button-confirm-signature"
            className="flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-4 py-2 text-xs font-medium text-white hover:bg-[#26215C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            تأكيد التوقيع وإنهاء اليومية
          </button>
        </div>
      </div>
    </div>
  );
}
