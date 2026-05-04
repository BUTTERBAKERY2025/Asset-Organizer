import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, MapPin, Loader2, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface CapturedPhoto {
  url: string;
  filePath?: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  capturedAt: string;
  caption?: string;
}

interface GPSPhotoCaptureProps {
  folder?: string;
  onUpload: (photo: CapturedPhoto) => void;
  buttonLabel?: string;
  required?: boolean;
}

async function getGPS(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (!("geolocation" in navigator)) return null;
  return await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
    );
  });
}

export function GPSPhotoCapture({ folder = "field", onUpload, buttonLabel = "التقاط صورة بالموقع", required }: GPSPhotoCaptureProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setGpsWarning(null);
    try {
      // Capture GPS in parallel with upload
      const [gps, uploaded] = await Promise.all([
        getGPS(),
        (async () => {
          const fd = new FormData();
          fd.append("file", file);
          const resp = await fetch(`/api/uploads?folder=${encodeURIComponent(folder)}`, {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || "فشل رفع الصورة");
          }
          return await resp.json();
        })(),
      ]);

      if (!gps && required) {
        setGpsWarning("تعذّر الحصول على الموقع — يُنصح بتفعيل GPS وإعادة المحاولة");
      } else if (!gps) {
        setGpsWarning("الصورة رُفعت بدون موقع جغرافي");
      }

      onUpload({
        url: uploaded.downloadUrl,
        filePath: uploaded.filePath,
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
        accuracy: gps?.accuracy ?? null,
        capturedAt: new Date().toISOString(),
      });
      toast({ title: "تم التقاط الصورة", description: gps ? `الموقع: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "بدون موقع" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل الرفع", variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="gps-photo-capture">
      <Input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        data-testid="input-photo-file"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full h-12 gap-2"
        data-testid="button-capture-photo"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        {busy ? "جارٍ الرفع..." : buttonLabel}
      </Button>
      {gpsWarning && (
        <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1" data-testid="text-gps-warning">
          <AlertTriangle className="h-3 w-3" /> {gpsWarning}
        </div>
      )}
    </div>
  );
}

export function PhotoThumb({ photo, onRemove }: { photo: CapturedPhoto; onRemove?: () => void }) {
  return (
    <Card className="relative overflow-hidden" data-testid={`card-photo-${photo.filePath || photo.url}`}>
      <CardContent className="p-2">
        <img src={photo.url} alt="" className="w-full h-32 object-cover rounded" />
        <div className="mt-2 flex items-center justify-between text-xs">
          {photo.lat != null && photo.lng != null ? (
            <a
              href={`https://www.google.com/maps?q=${photo.lat},${photo.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1"
              data-testid="link-photo-location"
            >
              <MapPin className="h-3 w-3" /> {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
            </a>
          ) : (
            <Badge variant="outline" className="text-xs">بدون موقع</Badge>
          )}
          {onRemove && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove} data-testid="button-remove-photo">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
