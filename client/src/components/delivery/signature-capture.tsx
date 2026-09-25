import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignatureCaptureProps = {
  disabled?: boolean;
  onChange: (value: string | null, hasInk: boolean) => void;
};

const hasInk = (canvas: HTMLCanvasElement) => {
  const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels) return false;
  let visible = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 235 || pixels[index + 1] < 235 || pixels[index + 2] < 235) visible += 1;
    if (visible >= 40) return true;
  }
  return false;
};

export function SignatureCapture({ disabled, onChange }: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef<string | null>(null);
  const drawingRef = useRef(false);
  const [drawn, setDrawn] = useState(false);

  const paintBackground = useCallback((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fbfaf7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#32255d";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  const restore = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = snapshotRef.current;
    paintBackground(canvas);
    if (!data) return;
    const image = new Image();
    image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = data;
  }, [paintBackground]);

  useEffect(() => {
    restore();
    const preserve = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      snapshotRef.current = canvas.toDataURL("image/png");
      requestAnimationFrame(restore);
    };
    window.addEventListener("resize", preserve);
    return () => window.removeEventListener("resize", preserve);
  }, [restore]);

  const coordinate = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = hasInk(canvas);
    setDrawn(ink);
    snapshotRef.current = canvas.toDataURL("image/png");
    onChange(ink ? snapshotRef.current : null, ink);
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = coordinate(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = coordinate(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commit();
  };
  const clear = () => {
    snapshotRef.current = null;
    restore();
    setDrawn(false);
    onChange(null, false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm" dir="rtl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">توقيع المستلم</p>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-2" onClick={clear} disabled={disabled}>
          <RotateCcw className="h-4 w-4" /> مسح
        </Button>
      </div>
      <canvas ref={canvasRef} width={960} height={310} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        className="h-36 w-full touch-none rounded-lg border border-dashed border-primary/35 bg-[#fbfaf7] [cursor:crosshair] md:h-44" aria-label="مساحة توقيع المستلم" />
      <p className="mt-2 text-xs text-muted-foreground">{drawn ? "تم رصد التوقيع. راجعه قبل الإرسال." : "وقّع داخل المساحة. يجب أن يحتوي التوقيع على أثر واضح."}</p>
    </div>
  );
}