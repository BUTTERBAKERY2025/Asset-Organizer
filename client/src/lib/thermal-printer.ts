// طابعة الكاشير الحرارية عبر البلوتوث (Web Bluetooth + ESC/POS)
// ملاحظة: يعمل على متصفح Chrome / Edge (أندرويد وسطح المكتب). غير مدعوم على iPhone/iPad (Safari).

export interface SavedPrinter {
  id: string;
  name: string;
  connectedAt: string;
}

const STORAGE_KEY = "pos_bt_printer";

// خدمات البلوتوث الشائعة لطابعات الإيصالات الحرارية
const PRINTER_SERVICES = [
  0x18f0, // Generic printer service (شائعة جداً في الطابعات الصينية)
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // خدمة ISSC/Microchip الشائعة
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // خدمة ISSC transparent UART
  "0000ff00-0000-1000-8000-00805f9b34fb", // خدمة شائعة في طابعات Goojprt/Xprinter
  "000018f0-0000-1000-8000-00805f9b34fb",
];

let device: BluetoothDevice | null = null;
let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
let onDisconnectCb: (() => void) | null = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
}

export function getSavedPrinter(): SavedPrinter | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPrinter) : null;
  } catch {
    return null;
  }
}

export function forgetPrinter(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  disconnectPrinter();
}

export function isPrinterConnected(): boolean {
  return !!(device?.gatt?.connected && writeChar);
}

export function getConnectedPrinterName(): string | null {
  return isPrinterConnected() ? device?.name || "طابعة بلوتوث" : null;
}

export function onPrinterDisconnect(cb: (() => void) | null) {
  onDisconnectCb = cb;
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    try {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.writeWithoutResponse || ch.properties.write) {
          return ch;
        }
      }
    } catch {
      // بعض الخدمات محمية — نتجاوزها
    }
  }
  return null;
}

/** فتح نافذة البحث عن الطابعات والاتصال بالطابعة المختارة */
export async function scanAndConnect(): Promise<SavedPrinter> {
  if (!isBluetoothSupported()) {
    throw new Error("متصفحك لا يدعم البلوتوث. استخدم Chrome أو Edge على أندرويد أو الكمبيوتر (غير مدعوم على أجهزة آبل iPhone/iPad).");
  }
  const bt = (navigator as any).bluetooth;
  const dev: BluetoothDevice = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  return connectToDevice(dev);
}

function handleGattDisconnected() {
  writeChar = null;
  onDisconnectCb?.();
}

async function connectToDevice(dev: BluetoothDevice): Promise<SavedPrinter> {
  if (!dev.gatt) throw new Error("هذا الجهاز لا يدعم الاتصال المباشر (GATT)");
  // فصل أي طابعة سابقة قبل التبديل لتجنب تراكم الاتصالات والمستمعين
  if (device && device !== dev) {
    try {
      device.removeEventListener("gattserverdisconnected", handleGattDisconnected);
      device.gatt?.disconnect();
    } catch {}
  }
  const server = await dev.gatt.connect();
  const ch = await findWritableCharacteristic(server);
  if (!ch) {
    dev.gatt.disconnect();
    throw new Error("تم الاتصال بالجهاز لكنه لا يبدو طابعة متوافقة (لا توجد قناة كتابة). تأكد من اختيار الطابعة الصحيحة.");
  }
  device = dev;
  writeChar = ch;
  dev.removeEventListener("gattserverdisconnected", handleGattDisconnected);
  dev.addEventListener("gattserverdisconnected", handleGattDisconnected);
  const saved: SavedPrinter = {
    id: dev.id,
    name: dev.name || "طابعة بلوتوث",
    connectedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {}
  return saved;
}

/** محاولة إعادة الاتصال بالطابعة المحفوظة سابقاً بدون فتح نافذة البحث */
export async function reconnectSavedPrinter(): Promise<SavedPrinter | null> {
  if (!isBluetoothSupported()) return null;
  const saved = getSavedPrinter();
  if (!saved) return null;
  const bt = (navigator as any).bluetooth;
  if (typeof bt.getDevices !== "function") return null; // يحتاج تفعيل Web Bluetooth Persistent Permissions
  try {
    const devices: BluetoothDevice[] = await bt.getDevices();
    const dev = devices.find((d) => d.id === saved.id);
    if (!dev) return null;
    return await connectToDevice(dev);
  } catch {
    return null;
  }
}

export function disconnectPrinter(): void {
  try {
    device?.removeEventListener("gattserverdisconnected", handleGattDisconnected);
    device?.gatt?.disconnect();
  } catch {}
  device = null;
  writeChar = null;
}

const CHUNK_SIZE = 180; // حجم آمن لمعظم طابعات BLE
const CHUNK_DELAY_MS = 25;

async function writeBytes(data: Uint8Array): Promise<void> {
  if (!writeChar) throw new Error("الطابعة غير متصلة. اربط الطابعة من إعدادات ربط طابعة الكاشير.");
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
  }
}

// ===== تحويل Canvas إلى أوامر ESC/POS (طباعة صورة نقطية — يدعم العربية بشكل كامل) =====

function canvasToRaster(canvas: HTMLCanvasElement, maxWidthDots = 384): Uint8Array {
  // تصغير العرض ليطابق عرض الطابعة (58mm = 384 نقطة، 80mm = 576 نقطة)
  let src = canvas;
  if (canvas.width > maxWidthDots) {
    const scaled = document.createElement("canvas");
    scaled.width = maxWidthDots;
    scaled.height = Math.round((canvas.height * maxWidthDots) / canvas.width);
    const c = scaled.getContext("2d")!;
    c.fillStyle = "#fff";
    c.fillRect(0, 0, scaled.width, scaled.height);
    c.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    src = scaled;
  }
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const img = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const raster = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = img[i + 3];
      // متوسط الإضاءة مع اعتبار الشفافية بيضاء
      const lum = a < 128 ? 255 : (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114);
      if (lum < 160) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  // GS v 0 — أمر طباعة صورة نقطية
  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const out = new Uint8Array(header.length + raster.length);
  out.set(header, 0);
  out.set(raster, header.length);
  return out;
}

export type PaperWidth = "58" | "80";

export function getPaperWidth(): PaperWidth {
  try {
    return (localStorage.getItem("pos_bt_paper") as PaperWidth) || "80";
  } catch {
    return "80";
  }
}

export function setPaperWidth(w: PaperWidth) {
  try {
    localStorage.setItem("pos_bt_paper", w);
  } catch {}
}

/** طباعة عنصر HTML (مثل الإيصال) على الطابعة الحرارية */
export async function printElement(el: HTMLElement): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const dots = getPaperWidth() === "58" ? 384 : 576;
  const init = new Uint8Array([0x1b, 0x40]); // ESC @ تهيئة
  const raster = canvasToRaster(canvas, dots);
  const feedCut = new Uint8Array([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]); // تغذية 4 أسطر + قص جزئي
  const all = new Uint8Array(init.length + raster.length + feedCut.length);
  all.set(init, 0);
  all.set(raster, init.length);
  all.set(feedCut, init.length + raster.length);
  await writeBytes(all);
}

/** طباعة تجريبية للتأكد من عمل الطابعة */
export async function printTest(storeName = "BEST BUTTER"): Promise<void> {
  const el = document.createElement("div");
  el.setAttribute("dir", "rtl");
  el.style.cssText = "position:fixed;left:-9999px;top:0;width:340px;background:#fff;color:#000;font-family:Cairo,Arial,sans-serif;padding:12px;text-align:center;font-size:16px;";
  el.innerHTML = `
    <div style="font-size:22px;font-weight:bold;">${storeName}</div>
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    <div>اختبار طباعة ناجح</div>
    <div>الطابعة مرتبطة مع النظام بنجاح</div>
    <div style="font-size:12px;margin-top:6px;">${new Date().toLocaleString("ar-SA")}</div>
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
  `;
  document.body.appendChild(el);
  try {
    await printElement(el);
  } finally {
    document.body.removeChild(el);
  }
}
