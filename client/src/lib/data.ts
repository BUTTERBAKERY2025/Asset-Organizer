import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  notes?: string;
};

export type BranchData = {
  id: string;
  name: string;
  inventory: InventoryItem[];
};

export const INVENTORY_DATA: BranchData[] = [
  {
    id: "medina",
    name: "فرع المدينة المنورة",
    inventory: [
      // BARISTA
      { id: "b-1", name: "مكينة لامرزوكو 2 جروب", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-2", name: "بورتا فلتر", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-3", name: "ستاند اكواب", quantity: 4, unit: "حبة", category: "باريستا" },
      { id: "b-4", name: "طاحونة اسبريسو", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-5", name: "تامبر كهربائي", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-6", name: "طاحونة دريب براتزا", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-7", name: "مكينة v60 اريا 5 جروب", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-8", name: "طاحونة Mahlkonig", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-9", name: "سخان مياه 20 لتر", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-10", name: "مكينة فيتكو", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-11", name: "حافظة قهوه 5 لتر", quantity: 4, unit: "حبة", category: "باريستا" },
      { id: "b-12", name: "حافظه قهوه 2.5 لتر", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-13", name: "حافظه قهوه 4.5", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-14", name: "مكينة برتقال فروكسول صغير", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-15", name: "جهاز حساس 4 جروب لقهوة اليوم", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-16", name: "بتشر مقاس 450", quantity: 3, unit: "حبة", category: "باريستا" },
      { id: "b-17", name: "بتشر مقاس 300", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-18", name: "بتشر مقاس 600", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-19", name: "صانعة ثلج ميجل", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-20", name: "ميزان شحن", quantity: 4, unit: "حبة", category: "باريستا" },
      { id: "b-21", name: "سيرفر مع القمع", quantity: 5, unit: "حبة", category: "باريستا" },
      { id: "b-22", name: "كاتل كهربائي 1 لتر", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-23", name: "كاتل برتقالي 500 مل", quantity: 2, unit: "حبة", category: "باريستا" },
      { id: "b-24", name: "ثالجه 2 باب ستيل", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-25", name: "شيكر مقاس 750", quantity: 4, unit: "حبة", category: "باريستا" },
      { id: "b-26", name: "خالط كهربائي للمشروبات", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-27", name: "كوب اسبريسو سراميك", quantity: 10, unit: "حبة", category: "باريستا" },
      { id: "b-28", name: "صحن خشبي لالسبريسو", quantity: 6, unit: "حبة", category: "باريستا" },
      { id: "b-29", name: "باسكت للبن", quantity: 1, unit: "حبة", category: "باريستا" },
      { id: "b-30", name: "طابعة كاشير", quantity: 1, unit: "حبة", category: "باريستا" },

      // CASHIER
      { id: "c-1", name: "ايباد مع الشاحن", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-2", name: "جهاز بيجر مع الشاحن", quantity: 7, unit: "حبة", category: "كاشير" },
      { id: "c-3", name: "صرافتين مع الشاحن", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-4", name: "ايباد المنيو", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-5", name: "طابعة كاشير", quantity: 2, unit: "حبة", category: "كاشير" },
      { id: "c-6", name: "مكينة صوت", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-7", name: "توصيله كهرباء", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-8", name: "جهاز هنقرستيشن مع الشاحن", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-9", name: "جهاز تو يو مع الشاحن", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-10", name: "طابعه ورق hp", quantity: 1, unit: "حبة", category: "كاشير" },
      { id: "c-11", name: "درج كاشير للنقدية", quantity: 1, unit: "حبة", category: "كاشير" },

      // KITCHEN
      { id: "k-1", name: "جريل غاز 4 عيون", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-2", name: "قالية زيت بالكهرباء", quantity: 2, unit: "حبة", category: "المطبخ" },
      { id: "k-3", name: "جريل", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-4", name: "ثالجة اندر كاونتر 4 باب", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-5", name: "ثالجة اندر كاونتر 2 باب", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-6", name: "فريزر 2 باب", quantity: 2, unit: "حبة", category: "المطبخ" },
      { id: "k-7", name: "شوك فريزر", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-8", name: "عجان", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-9", name: "ميكسر", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-10", name: "فرادة عجين", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-11", name: "عجان صغير", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-12", name: "مسدس لهب TOTAL", quantity: 2, unit: "حبة", category: "المطبخ" },
      { id: "k-13", name: "ترولى", quantity: 2, unit: "حبة", category: "المطبخ" },
      { id: "k-14", name: "راك استيل", quantity: 36, unit: "حبة", category: "المطبخ" },
      { id: "k-15", name: "راك بالستيك أبيض كبير", quantity: 55, unit: "حبة", category: "المطبخ" },
      { id: "k-16", name: "راك بالستيك ابيض صغير", quantity: 5, unit: "حبة", category: "المطبخ" },
      { id: "k-17", name: "طابعة كاشير", quantity: 1, unit: "حبة", category: "المطبخ" },
      { id: "k-18", name: "مضرب كهربائي", quantity: 1, unit: "حبة", category: "المطبخ" },

      // PIZZA
      { id: "p-1", name: "ثالجة اندر كاونتر 2 باب", quantity: 1, unit: "حبة", category: "بيتزا" },
      { id: "p-2", name: "فرن بيتزا", quantity: 1, unit: "حبة", category: "بيتزا" },
      { id: "p-3", name: "مكنسة فرن", quantity: 1, unit: "حبة", category: "بيتزا" },
      { id: "p-4", name: "بيل التقاط بيتزا", quantity: 2, unit: "حبة", category: "بيتزا" },
      { id: "p-5", name: "طابعة كاشير", quantity: 1, unit: "حبة", category: "بيتزا" },

      // GENERAL / FURNITURE
      { id: "g-1", name: "كرسي شبك", quantity: 54, unit: "حبة", category: "أثاث وعام" },
      { id: "g-2", name: "طاولة دائرية", quantity: 19, unit: "حبة", category: "أثاث وعام" },
      { id: "g-3", name: "كرسي خشب", quantity: 12, unit: "حبة", category: "أثاث وعام" },
      { id: "g-4", name: "كرسي خشب صغير", quantity: 5, unit: "حبة", category: "أثاث وعام" },
      { id: "g-5", name: "طاولة خشب", quantity: 2, unit: "حبة", category: "أثاث وعام" },
      { id: "g-6", name: "طاولة دائريى رخام", quantity: 3, unit: "حبة", category: "أثاث وعام" },
      { id: "g-7", name: "طاولة مربعة رخام", quantity: 3, unit: "حبة", category: "أثاث وعام" },
      { id: "g-8", name: "كرسي جلد", quantity: 9, unit: "حبة", category: "أثاث وعام" },
      { id: "g-9", name: "جلسات ساكو", quantity: 12, unit: "حبة", category: "أثاث وعام" },
      { id: "g-10", name: "دفاية غاز", quantity: 5, unit: "حبة", category: "أثاث وعام" },
      { id: "g-11", name: "صندوق بلدية", quantity: 6, unit: "حبة", category: "أثاث وعام" },
      { id: "g-12", name: "مظلة BB", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-13", name: "شاشة 32 بوصة", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-14", name: "شاشة 98 بوصة", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-15", name: "ستارة هواء", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-16", name: "تكييف", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-17", name: "جريالت سوداء", quantity: 19, unit: "حبة", category: "أثاث وعام" },
      { id: "g-18", name: "سماعات", quantity: 6, unit: "حبة", category: "أثاث وعام" },
      { id: "g-19", name: "راوتر انترنت", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-20", name: "كاميرات مراقبة 360 درجة", quantity: 3, unit: "حبة", category: "أثاث وعام" },
      { id: "g-21", name: "كاميرات مراقبة", quantity: 14, unit: "حبة", category: "أثاث وعام" },
      { id: "g-22", name: "وحدة تحكم بالكاميرات", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-23", name: "جهاز تسجيل الكاميرات", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-24", name: "صندوق أجهزة الكاميرات", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-25", name: "صندوق شاشة + شاتر", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-26", name: "طفاية حريق", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-27", name: "لوجو بتر بيكرى", quantity: 5, unit: "حبة", category: "أثاث وعام" },
      { id: "g-28", name: "فخاريات", quantity: 15, unit: "حبة", category: "أثاث وعام" },
      { id: "g-29", name: "صائد حشرات", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-30", name: "دينامو مضخة مياه", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-31", name: "غطاس", quantity: 2, unit: "حبة", category: "أثاث وعام" },
      { id: "g-32", name: "خزان مياه", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-33", name: "عوامة", quantity: 2, unit: "حبة", category: "أثاث وعام" },
      { id: "g-34", name: "سخان مياه كهرباء", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-35", name: "غرفة تبريد", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-36", name: "باب خزان ارضى", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-37", name: "أسطوانة غاز", quantity: 5, unit: "حبة", category: "أثاث وعام" },
      { id: "g-38", name: "طقم مفكات", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-39", name: "باب خشب", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-40", name: "باب دفاع مدنى", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-41", name: "ستارة قماش مطبوع bb", quantity: 20, unit: "حبة", category: "أثاث وعام" },
      { id: "g-42", name: "شفاط دخان", quantity: 2, unit: "حبة", category: "أثاث وعام" },
      { id: "g-43", name: "ماكينة غرفة التبريد", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-44", name: "وحدات تكييف خارجية", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-45", name: "قطع ضخ مياه النافورة", quantity: 3, unit: "حبة", category: "أثاث وعام" },
      { id: "g-46", name: "كشاف النافورة", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-47", name: "كشاف طوارئ", quantity: 4, unit: "حبة", category: "أثاث وعام" },
      { id: "g-48", name: "كشاف زرع", quantity: 45, unit: "حبة", category: "أثاث وعام" },
      { id: "g-49", name: "صندوق خشب بتر بيكرى", quantity: 6, unit: "حبة", category: "أثاث وعام" },
      { id: "g-50", name: "ثالجة عرض 1.5م", quantity: 2, unit: "حبة", category: "أثاث وعام" },
      { id: "g-51", name: "ثالجة عرض 1.2 م", quantity: 1, unit: "حبة", category: "أثاث وعام" },
      { id: "g-52", name: "رف ستيل معلق", quantity: 9, unit: "حبة", category: "أثاث وعام" },
      { id: "g-53", name: "طاولة ستيل", quantity: 5, unit: "حبة", category: "أثاث وعام" },
      { id: "g-54", name: "رف ستيل ارضي", quantity: 3, unit: "حبة", category: "أثاث وعام" },
    ]
  },
  {
    id: "tabuk",
    name: "فرع تبوك",
    inventory: [] // Placeholder
  }
];
