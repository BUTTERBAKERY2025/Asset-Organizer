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

// ===== إبقاء الاتصال حيّاً + إعادة اتصال تلقائية =====
// كثير من الطابعات تفصل البلوتوث تلقائياً إذا لم تستقبل بيانات لفترة قصيرة (توفير طاقة)

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let reconnecting = false;
let intentionalDisconnect = false;
let onReconnectCb: ((p: SavedPrinter) => void) | null = null;

export function onPrinterReconnect(cb: ((p: SavedPrinter) => void) | null) {
  onReconnectCb = cb;
}

const KEEPALIVE_MS = 15000;
// DLE EOT 1 — طلب حالة الطابعة (لا يطبع شيئاً، فقط يُبقي القناة نشطة)
const KEEPALIVE_BYTES = new Uint8Array([0x10, 0x04, 0x01]);

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(async () => {
    if (!writeChar || !device?.gatt?.connected) return;
    try {
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(KEEPALIVE_BYTES);
      } else {
        await writeChar.writeValue(KEEPALIVE_BYTES);
      }
    } catch {
      // فشل النبضة — سيتكفل حدث الانقطاع بإعادة الاتصال
    }
  }, KEEPALIVE_MS);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

async function tryAutoReconnect() {
  if (reconnecting || intentionalDisconnect || !device?.gatt) return;
  reconnecting = true;
  try {
    // 3 محاولات بفواصل متزايدة
    for (let attempt = 1; attempt <= 3; attempt++) {
      await new Promise((r) => setTimeout(r, attempt * 1500));
      if (intentionalDisconnect || !device?.gatt) return;
      try {
        const server = await device.gatt.connect();
        const ch = await findWritableCharacteristic(server);
        if (ch) {
          writeChar = ch;
          startKeepAlive();
          const saved = getSavedPrinter();
          if (saved) onReconnectCb?.(saved);
          return;
        }
      } catch {
        // نحاول مرة أخرى
      }
    }
    onDisconnectCb?.();
  } finally {
    reconnecting = false;
  }
}

function handleGattDisconnected() {
  writeChar = null;
  stopKeepAlive();
  if (!intentionalDisconnect) {
    // لا نبلغ الواجهة فوراً — نحاول إعادة الاتصال بصمت أولاً
    void tryAutoReconnect();
  } else {
    onDisconnectCb?.();
  }
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
  intentionalDisconnect = false;
  dev.removeEventListener("gattserverdisconnected", handleGattDisconnected);
  dev.addEventListener("gattserverdisconnected", handleGattDisconnected);
  startKeepAlive();
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

/** ضمان اتصال الطابعة: إذا فيه طابعة محفوظة وغير متصلة، أعد الاتصال بها بصمت */
export async function ensurePrinterConnection(): Promise<boolean> {
  if (isPrinterConnected()) return true;
  const p = await reconnectSavedPrinter();
  return !!p;
}

// إعادة الاتصال تلقائياً عند الرجوع للتطبيق (تغيير تبويبات المتصفح / قفل الشاشة)
// + مراقب دائم يفحص الاتصال كل 10 ثوانٍ ويعيده إذا انقطع أثناء التنقل بين الصفحات
let visibilityHookInstalled = false;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

function silentReconnect() {
  if (intentionalDisconnect || reconnecting) return;
  if (!getSavedPrinter() || isPrinterConnected()) return;
  void ensurePrinterConnection().then((ok) => {
    const saved = getSavedPrinter();
    if (ok && saved) onReconnectCb?.(saved);
  });
}

export function installAutoReconnectOnVisibility(): void {
  if (visibilityHookInstalled || typeof document === "undefined") return;
  visibilityHookInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") silentReconnect();
  });
  watchdogTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") silentReconnect();
  }, 10000);
}

export function disconnectPrinter(): void {
  intentionalDisconnect = true;
  stopKeepAlive();
  try {
    device?.removeEventListener("gattserverdisconnected", handleGattDisconnected);
    device?.gatt?.disconnect();
  } catch {}
  device = null;
  writeChar = null;
}

// إرسال بيانات الطباعة بشكل موثوق:
// المشكلة السابقة: الإرسال "بدون تأكيد استلام" وبسرعة أعلى من قدرة الطابعة كان يُفيض
// ذاكرتها فتسقط أجزاء من الصورة — أول جزء (الشعار) يخرج سليماً ثم يتهشم الباقي.
// الحل: نفضّل الكتابة "مع تأكيد استلام" (تحكم تدفق مضمون على مستوى البلوتوث)،
// وإن لم تدعمها الطابعة نرسل قطعاً أصغر مع فواصل أطول واستراحة دورية لتفريغ الذاكرة.
async function writeBytes(data: Uint8Array): Promise<void> {
  if (!writeChar) throw new Error("الطابعة غير متصلة. اربط الطابعة من إعدادات ربط طابعة الكاشير.");
  if (writeChar.properties.write) {
    // موثوق: كل قطعة تُؤكَّد قبل إرسال التالية — لا يمكن فقدان بيانات
    const CH = 180;
    for (let i = 0; i < data.length; i += CH) {
      await writeChar.writeValue(data.slice(i, i + CH));
    }
    return;
  }
  // بدون تأكيد: قطع صغيرة (ضمن حدود MTU الشائعة) + إبطاء + استراحة كل ~2كيلوبايت
  const CH = 96;
  let sentSinceRest = 0;
  for (let i = 0; i < data.length; i += CH) {
    await writeChar.writeValueWithoutResponse(data.slice(i, i + CH));
    sentSinceRest += CH;
    await new Promise((r) => setTimeout(r, 25));
    if (sentSinceRest >= 2048) {
      sentSinceRest = 0;
      await new Promise((r) => setTimeout(r, 250)); // مهلة لتفريغ ذاكرة الطابعة
    }
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
  let raster = new Uint8Array(bytesPerRow * height);
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
  // قص الفراغ الأبيض في أسفل الإيصال — بيانات أقل = طباعة أسرع وورق أوفر
  let lastRow = height - 1;
  outer: for (; lastRow >= 0; lastRow--) {
    const start = lastRow * bytesPerRow;
    for (let b = 0; b < bytesPerRow; b++) {
      if (raster[start + b] !== 0) break outer;
    }
  }
  const trimmedHeight = Math.max(1, lastRow + 1);
  if (trimmedHeight < height) raster = raster.slice(0, trimmedHeight * bytesPerRow);
  // GS v 0 — طباعة الصورة على شكل شرائح مستقلة (كل شريحة أمر كامل بذاته)
  // حتى لو حدث خلل في نقل شريحة، لا يمتد التشوه لباقي الفاتورة
  const BAND_ROWS = 64;
  const bandCount = Math.ceil(trimmedHeight / BAND_ROWS);
  const out = new Uint8Array(bandCount * 8 + raster.length);
  let off = 0;
  for (let b = 0; b < bandCount; b++) {
    const rows = Math.min(BAND_ROWS, trimmedHeight - b * BAND_ROWS);
    out.set([
      0x1d, 0x76, 0x30, 0x00,
      bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    ], off);
    off += 8;
    const start = b * BAND_ROWS * bytesPerRow;
    out.set(raster.subarray(start, start + rows * bytesPerRow), off);
    off += rows * bytesPerRow;
  }
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

/**
 * تجهيز نسخة مكبّرة من الإيصال للطباعة الحرارية:
 * نضاعف حجم الخطوط والشعار مع تثبيت عرض التخطيط، فيخرج الكلام أكبر وأوضح على الورق.
 */
function buildBoostedClone(el: HTMLElement, fontBoost: number): { target: HTMLElement; cleanup: () => void } {
  const wrapper = document.createElement("div");
  const width = el.offsetWidth || 300;
  wrapper.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;background:#fff;z-index:-1;`;
  const clone = el.cloneNode(true) as HTMLElement;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const origEls: Element[] = [el, ...Array.from(el.querySelectorAll("*"))];
  const cloneEls: Element[] = [clone, ...Array.from(clone.querySelectorAll("*"))];
  origEls.forEach((o, i) => {
    const c = cloneEls[i] as HTMLElement | undefined;
    if (!c || !(c instanceof HTMLElement)) return;
    const cs = window.getComputedStyle(o);
    const fs = parseFloat(cs.fontSize);
    if (fs) {
      c.style.fontSize = `${Math.round(fs * fontBoost * 10) / 10}px`;
      c.style.lineHeight = "1.6";
    }
    // منع تقطيع النصوص: نسمح بالالتفاف لأسطر جديدة بدل القص أو النقاط (...)
    c.style.overflow = "visible";
    if (cs.textOverflow === "ellipsis") c.style.textOverflow = "clip";
    if (cs.whiteSpace === "nowrap" && c.tagName !== "TD" && c.tagName !== "TH") c.style.whiteSpace = "normal";
    // خطوط رفيعة تظهر باهتة على الطابعة الحرارية — نرفعها لدرجة أوضح
    const weight = parseInt(cs.fontWeight, 10);
    if (!isNaN(weight) && weight < 600) c.style.fontWeight = "600";
    // تكبير الشعار والصور بنفس النسبة (مع سقف 80% من عرض الورقة)
    if (c.tagName === "IMG") {
      const h = (o as HTMLElement).clientHeight || parseFloat(cs.height) || 0;
      const w = (o as HTMLElement).clientWidth || 0;
      if (h) {
        c.style.maxHeight = `${Math.round(h * fontBoost * 1.25)}px`;
        c.style.height = "auto";
      }
      if (w) c.style.maxWidth = `${Math.min(Math.round(width * 0.8), Math.round(w * fontBoost * 1.25))}px`;
    }
    // تكبير رمز QR (عنصر SVG) بنفس النسبة ليكون واضحاً وسهل المسح
    if (c.tagName.toLowerCase() === "svg") {
      const w = (o as HTMLElement).clientWidth || 0;
      const h = (o as HTMLElement).clientHeight || 0;
      if (w && h) {
        const s = Math.min(Math.round(width * 0.6), Math.round(w * fontBoost));
        c.style.width = `${s}px`;
        c.style.height = `${Math.round((h / w) * s)}px`;
      }
    }
  });
  return { target: clone, cleanup: () => wrapper.remove() };
}

/** طباعة عنصر HTML (مثل الإيصال) على الطابعة الحرارية */
export async function printElement(el: HTMLElement, opts?: { fontBoost?: number }): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const boost = opts?.fontBoost ?? 1;
  let target: HTMLElement = el;
  let cleanup: (() => void) | null = null;
  if (boost !== 1) {
    const built = buildBoostedClone(el, boost);
    target = built.target;
    cleanup = built.cleanup;
  }
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(target, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
  } finally {
    cleanup?.();
  }
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
