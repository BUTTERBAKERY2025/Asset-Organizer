import { describe, expect, it } from "vitest";
import {
  buildRecipePrintDocument,
  closeRecipePrintWindow,
  escapePrintHtml,
  openRecipePrintWindow,
  recipeHasPermission,
  RECIPE_PERMISSION_MODULE,
  writeRecipePrintDocument,
} from "../client/src/components/central-kitchen/recipe-book";

const recipe = {
  id: 7,
  kitchenId: "kitchen-1",
  kitchenName: "مطبخ <المركز>",
  productId: 11,
  productName: "منتج <جاهز> & خاص",
  outputQuantity: 12.5,
  outputUnit: "صندوق",
  notes: "سطر أول <script>alert('x')</script>\nسطر ثانٍ & ملاحظة",
  status: "approved" as const,
  version: 3,
  updateToken: "recipe-update-token",
  supersedesRecipeId: null,
  supersededByRecipeId: null,
  createdBy: "creator",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedBy: "editor",
  updatedAt: "2025-01-02T00:00:00.000Z",
  approvedBy: "approver",
  approvedAt: "2025-01-03T00:00:00.000Z",
  supersededAt: null,
  ingredients: [
    { id: 1, warehouseItemId: 21, name: "مادة <خام>", quantity: 2.25, unit: "كجم & وحدة" },
  ],
};

describe("central kitchen recipe print helpers", () => {
  it("escapes every HTML-sensitive character", () => {
    expect(escapePrintHtml(`<tag attr="x"> & 'quoted'`)).toBe(
      "&lt;tag attr=&quot;x&quot;&gt; &amp; &#39;quoted&#39;",
    );
  });

  it("creates an Arabic RTL print document without injecting recipe data as markup", () => {
    const document = buildRecipePrintDocument(recipe);

    expect(document).toContain('<html lang="ar" dir="rtl">');
    expect(document).toContain("منتج &lt;جاهز&gt; &amp; خاص");
    expect(document).toContain("مطبخ &lt;المركز&gt;");
    expect(document).toContain("مادة &lt;خام&gt;");
    expect(document).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(document).not.toContain("<script>alert");
    expect(document).toContain("الإصدار");
    expect(document).toContain("معتمدة");
    expect(document).toContain("2.25");
    expect(document).toContain("كجم &amp; وحدة");
    expect(document).toContain("الاعتماد وحده لا يخصم المخزون");
    expect(document).toContain("يمكن إنشاء دفعة غير مرتبطة");
  });

  it("opens the print window synchronously through the supplied click-time helper", () => {
    const events: string[] = [];
    const popup = {} as Window;
    const result = openRecipePrintWindow((url, target) => {
      events.push(`open:${url}:${target}`);
      return popup;
    });

    expect(result).toBe(popup);
    expect(events).toEqual(["open::_blank"]);
  });

  it("closes the already-open popup when document rendering or printing fails", () => {
    let closed = false;
    const popup = {
      document: {
        open: () => { throw new Error("document unavailable"); },
        write: () => undefined,
        close: () => undefined,
      },
      focus: () => undefined,
      print: () => undefined,
      close: () => { closed = true; },
    } as unknown as Window;

    expect(() => writeRecipePrintDocument(popup, recipe)).toThrow("document unavailable");
    expect(closed).toBe(true);
  });

  it("safely closes a popup when the print request fails", () => {
    let closed = false;
    const popup = { close: () => { closed = true; } } as unknown as Window;

    closeRecipePrintWindow(popup);

    expect(closed).toBe(true);
  });
});

describe("central kitchen recipe frontend permissions", () => {
  it("checks the dedicated recipe module for every supported action", () => {
    const calls: Array<[string, string]> = [];
    const hasPermission = (module: any, action: any) => {
      calls.push([module, action]);
      return action === "print";
    };

    const actions = ["view", "create", "edit", "delete", "approve", "print"] as const;
    expect(actions.map(action => recipeHasPermission(hasPermission, action))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(calls).toEqual(actions.map(action => [RECIPE_PERMISSION_MODULE, action]));
  });
});