import {
  CENTRAL_KITCHEN_RECIPE_IMPORT_UNRESOLVED_MARKER,
  findStrictCentralKitchenRecipeImportMatches,
  normalizeCentralKitchenRecipeImportName,
  type CentralKitchenRecipeImportCatalogItem,
  type CentralKitchenRecipeImportContract,
  type CentralKitchenRecipeImportSource,
  type CentralKitchenRecipeImportSourceIngredient,
} from "@shared/central-kitchen-recipes";

const unresolved = (message: string): string =>
  `${CENTRAL_KITCHEN_RECIPE_IMPORT_UNRESOLVED_MARKER}: ${message}`;

function row(
  rawName: string,
  rawQuantity: string | null,
  rawUnit: string | null,
  issue?: string,
): CentralKitchenRecipeImportSourceIngredient {
  return { rawName, rawQuantity, rawUnit, issue: issue || null };
}

/*
 * This is a server-side transcription of the source workbook.  Do not move
 * it into client assets: the workbook contains the bakery's recipe formulas.
 * rawSourceText intentionally retains the cell text (including source typos,
 * blank units and the recipe sections outside A6).
 */
export const PASTRY_RECIPE_IMPORT_SOURCES: readonly CentralKitchenRecipeImportSource[] = [
  {
    sourceId: "pastry-creme-brulee",
    name: "CREME BRULEE",
    suggestedProductName: "CREME BRULEE",
    outputQuantity: 50,
    outputUnit: "piece",
    rawSourceText: "Cremebrulee :\nPhiladelphia-3.840 kg\nSugar-720gr\nEgg Yellow-600 gr\nEgg Whole-720 gr\nFlour-45  60 gr\nCornflour-120 gr\nSalt-10 gr\nVanilla-60 gr\nCream-1.2 kg\n\nINGREDIENTS:   50pcs",
    ingredients: [
      row("Philadelphia", "3.840", "kg"),
      row("Sugar", "720", "gr"),
      row("Egg Yellow", "600", "gr"),
      row("Egg Whole", "720", "gr"),
      row("Flour-45", "60", "gr"),
      row("Cornflour", "120", "gr"),
      row("Salt", "10", "gr"),
      row("Vanilla", "60", "gr"),
      row("Cream", "1.2", "kg"),
    ],
  },
  {
    sourceId: "pastry-bb-cake",
    name: "B.B CAKE",
    suggestedProductName: "B.B CAKE",
    outputQuantity: 85,
    outputUnit: "piece",
    rawSourceText: "Mousse chocolat \n*3000 kg liquide cream \n*1400 kg caramel \n*1500 kg milk chocolate \n*1500 kg dark chocolate \n*200 g gelatin \n*5000 kg whipping cream \nDawn sponge \n3kg powder \n1.05 g egg\n900 g oil\n840 g water\n\npecan caramelisses\n750 gr sugar\n750 gr water\n1500 kg pecan\nspray chocolate\n500 gr dark chocolate\n500 gr milk chocolate\n1000 kg cacao butter\nsugar dough\n250 gr\n\n75 pcs Digestive Biscuits\nINGREDIENTS:   75pcs.         Riang 5s.                    85pcs Riang 4s\nBb Cake Sauce\nMilk-1000 gr\nCream Elle and Vire-1000 gr\nNutella-200 gr\nDark Chocolate -500 gr\ncaramel 200 gr",
    ingredients: [
      row("liquide cream", "3000", "kg", "Doubtful numeric source quantity; preserve 3000 kg and acknowledge/correct before save."),
      row("caramel", "1400", "kg", "Doubtful numeric source quantity; preserve 1400 kg and acknowledge/correct before save."),
      row("milk chocolate", "1500", "kg", "Doubtful numeric source quantity; preserve 1500 kg and acknowledge/correct before save."),
      row("dark chocolate", "1500", "kg", "Doubtful numeric source quantity; preserve 1500 kg and acknowledge/correct before save."),
      row("gelatin", "200", "g"),
      row("whipping cream", "5000", "kg", "Doubtful numeric source quantity; preserve 5000 kg and acknowledge/correct before save."),
      row("powder", "3", "kg"),
      row("egg", "1.05", "g", "The source says 1.05 g egg; do not infer a piece count."),
      row("oil", "900", "g"),
      row("water", "840", "g"),
      row("sugar", "750", "gr"),
      row("water", "750", "gr"),
      row("pecan", "1500", "kg", "Doubtful numeric source quantity; preserve 1500 kg and acknowledge/correct before save."),
      row("dark chocolate", "500", "gr"),
      row("milk chocolate", "500", "gr"),
      row("cacao butter", "1000", "kg", "Doubtful numeric source quantity; preserve 1000 kg and acknowledge/correct before save."),
      row("sugar dough", "250", "gr"),
      row("Digestive Biscuits", "75", "pcs", "The source says 75 pcs; the confirmed digestive catalog unit is kg, so no piece-to-weight conversion is made."),
      row("Milk", "1000", "gr"),
      row("Cream Elle and Vire", "1000", "gr"),
      row("Nutella", "200", "gr"),
      row("Dark Chocolate", "500", "gr"),
      row("caramel", "200", "gr"),
    ],
  },
  {
    sourceId: "pastry-rocher",
    name: "ROCHER",
    suggestedProductName: "ROCHER",
    outputQuantity: 64,
    outputUnit: "piece",
    rawSourceText: "* 380 g egg whites\n* 300 g sugar\n* 100 g icing sugar\n* 320 g hazelnut powder \n* 100 g flour\nCream mousse chocolate \n750gr milk\n150gregg yolk \n1.8grchocolate milk \n180gr gelatine \n1.8gr cream whipping \nCrunchy \n800gr   feuilletine \n560g dark chocolate \n560g hazelnut praline\n\nFrosting : Milk: 250 g\n* Whipping cream: 125 g\n* Egg yolks: 75 g\n* Corn flour: 20 g\n* Sugar: 190 g\n* Milk chocolate: 50 g\n* Salt: 1.4 g\n\nINGREDIENTS:   64 pcs",
    ingredients: [
      row("egg whites", "380", "g"),
      row("sugar", "300", "g"),
      row("icing sugar", "100", "g"),
      row("hazelnut powder", "320", "g"),
      row("flour", "100", "g"),
      row("milk", "750", "gr"),
      row("egg yolk", "150", "g"),
      row("chocolate milk", "1.8", "gr", "Doubtful numeric source quantity: the source says 1.8 gr chocolate milk; preserve the value and acknowledge/correct before save."),
      row("gelatine", "180", "gr"),
      row("cream whipping", "1.8", "gr", "Doubtful numeric source quantity: the source says 1.8 gr cream whipping; preserve the value and acknowledge/correct before save."),
      row("feuilletine", "800", "gr"),
      row("dark chocolate", "560", "g"),
      row("hazelnut praline", "560", "g"),
      row("Milk", "250", "g"),
      row("Whipping cream", "125", "g"),
      row("Egg yolks", "75", "g"),
      row("Corn flour", "20", "g"),
      row("Sugar", "190", "g"),
      row("Milk chocolate", "50", "g"),
      row("Salt", "1.4", "g"),
    ],
  },
  {
    sourceId: "pastry-san-sebastian",
    name: "SAN SEBASTIAN",
    suggestedProductName: "SAN SEBASTIAN",
    outputQuantity: 72,
    outputUnit: "piece",
    rawSourceText: "5280 philadelphia\n2640 mascarpone \n1980 whole egg\n1320Cream liquid\n2160 Sugar\n120 Flour t45 \nFor 1 ring 2200 gr\n *Biscuits base\n600 flour\n240 Ising sugar \n 330Butter \nAlmond powder 90\nEgg 120\nSalt 6 \nFor 1 ring 220 gr\nCook time \n35 min\n205 degree\nFan3\n\nINGREDIENTS:   72 pcs\nSan Sebastian and Matilda Sauce.\nNutella-3kg\nMilk-2kg ",
    ingredients: [
      row("philadelphia", "5280", null),
      row("mascarpone", "2640", null),
      row("whole egg", "1980", null),
      row("Cream liquid", "1320", null),
      row("Sugar", "2160", null),
      row("Flour t45", "120", null),
      row("flour", "600", null),
      row("Ising sugar", "240", null),
      row("Butter", "330", null),
      row("Almond powder", "90", null),
      row("Egg", "120", null),
      row("Salt", "6", null),
      row("Nutella", "3", "kg"),
      row("Milk", "2", "kg"),
    ],
  },
  {
    sourceId: "pastry-honey-cake",
    name: "HONEY CAKE",
    suggestedProductName: "HONEY CAKE",
    outputQuantity: 40,
    outputUnit: "piece",
    rawSourceText: "Butter 500 g\nSugar 150 g\nEgg-640g\nHoney-640g\nBaking Soda-30g\nCinnamon-10g\nFlour 890 gram\nSalt-2 grams\nPhiladelphia-1500kg                      \nCréam-2500 g\nButter-500g\nSugar-500g\nCaramel-500g\n\nINGREDIENTS:   40 pcs",
    ingredients: [
      row("Butter", "500", "g"),
      row("Sugar", "150", "g"),
      row("Egg", "640", "g"),
      row("Honey", "640", "g"),
      row("Baking Soda", "30", "g"),
      row("Cinnamon", "10", "g"),
      row("Flour", "890", "gram"),
      row("Salt", "2", "grams"),
      row("Philadelphia", "1500", "kg", "Doubtful numeric source quantity; preserve 1500 kg and acknowledge/correct before save."),
      row("Créam", "2500", "g"),
      row("Butter", "500", "g"),
      row("Sugar", "500", "g"),
      row("Caramel", "500", "g"),
    ],
  },
  {
    sourceId: "pastry-choclate-cookies",
    name: "CHOCLATE COOKIES",
    suggestedProductName: "CHOCLATE COOKIES",
    outputQuantity: 35,
    outputUnit: "piece",
    rawSourceText: "COOKIES\nButter-770 grams\nBrown Sugar-980 grams\nEgg-7 pcs.\nFlour-1400 grams\nBaking Powder-21 grams\nBaking Soda-21 grams\nChocolate  dark 630 gr \n\n1 pc- 100 grams\n\nINGREDIENTS:   35 pcs ",
    ingredients: [
      row("Butter", "770", "grams"),
      row("Brown Sugar", "980", "grams"),
      row("Egg", "7", "pcs"),
      row("Flour", "1400", "grams"),
      row("Baking Powder", "21", "grams"),
      row("Baking Soda", "21", "grams"),
      row("Chocolate dark", "630", "gr"),
    ],
  },
  {
    sourceId: "pastry-mini-honey-cake-box",
    name: "MINI HONEY CAKE BOX",
    suggestedProductName: "MINI HONEY CAKE BOX",
    outputQuantity: 12,
    outputUnit: "box",
    rawSourceText: "Butter 500 g\nSugar 150 g\nEgg-640g\nHoney-640g\nBaking Soda-30g\nCinnamon-10g\nFlour 890 gram\nSalt-2 grams\nPhiladelphia-1500gr                            Créma\nCréam-2500 g\nButter-500g\nSugar-500g\nCaramel-500g\n\nINGREDIENTS:   12 box",
    ingredients: [
      row("Butter", "500", "g"),
      row("Sugar", "150", "g"),
      row("Egg", "640", "g"),
      row("Honey", "640", "g"),
      row("Baking Soda", "30", "g"),
      row("Cinnamon", "10", "g"),
      row("Flour", "890", "gram"),
      row("Salt", "2", "grams"),
      row("Philadelphia", "1500", "gr"),
      row("Créam", "2500", "g"),
      row("Butter", "500", "g"),
      row("Sugar", "500", "g"),
      row("Caramel", "500", "g"),
    ],
  },
  {
    sourceId: "pastry-madrid-cheeseca",
    name: "MADRID CHEESECA",
    suggestedProductName: "MADRID CHEESECA",
    outputQuantity: 60,
    outputUnit: "piece",
    rawSourceText: "5280 philadelphia\n2640 mascarpone \n1980 whole egg\n1320Cream liquid\n2160 Sugar\n120 Flour t45 \nFor 1 ring 2200 gr\n *Biscuits base\n600 flour\n240 Ising sugar \n 330Butter \nAlmond powder 90\nEgg 120\nSalt 6 \nFor 1 ring 220 gr\nCook time \n35 min\n205 degree\nFan3\n\nINGREDIENTS:   60pcs",
    ingredients: [
      row("philadelphia", "5280", null),
      row("mascarpone", "2640", null),
      row("whole egg", "1980", null),
      row("Cream liquid", "1320", null),
      row("Sugar", "2160", null),
      row("Flour t45", "120", null),
      row("flour", "600", null),
      row("Ising sugar", "240", null),
      row("Butter", "330", null),
      row("Almond powder", "90", null),
      row("Egg", "120", null),
      row("Salt", "6", null),
    ],
  },
  {
    sourceId: "pastry-choclate-matilda",
    name: "CHOCLATE MATILDA",
    suggestedProductName: "CHOCLATE MATILDA",
    outputQuantity: 34,
    outputUnit: "piece",
    rawSourceText: "190gr Galatin\nDwn choclate 1000 kg \nEgg 350 g\nOil 300g\nWater 220\nFor 1tray 1400 \nCook time 180 degree\n10 minute \nCrémeux caramel\n1250g milk \n625g whipping cream \n375g egg yolk\n- 100g corn flour \n* 950g sugar \n250 g chocolat milk\n180 grGanache     \n\nINGREDIENTS:   \n 34 pcs ",
    ingredients: [
      row("Galatin", "190", "gr"),
      row("Dwn choclate", "1000", "kg", "Doubtful numeric source quantity: the source says 1000 kg Dwn choclate; preserve the typo and quantity and acknowledge/correct before save."),
      row("Egg", "350", "g"),
      row("Oil", "300", "g"),
      row("Water", "220", null),
      row("milk", "1250", "g"),
      row("whipping cream", "625", "g"),
      row("egg yolk", "375", "g"),
      row("corn flour", "100", "g"),
      row("sugar", "950", "g"),
      row("chocolat milk", "250", "g"),
      row("Ganache", "180", "gr"),
    ],
  },
  {
    sourceId: "pastry-madeline-biscuit",
    name: "Madeline biscuit",
    suggestedProductName: "Madeline biscuit",
    outputQuantity: 88,
    outputUnit: "piece",
    rawSourceText: "MADELEINE BISCUIT:\n630eggs\n590 sugar\n565butter\n210 semi-skimmed milk Room temperature \n525 flour T45\n25 baking powder\n60 honey\n40 oil\n3 gfleur de sel\n5 vanilla pod\n\nChocolate white 1600gr\ngreen color 10 gr",
    ingredients: [
      row("eggs", "630", null),
      row("sugar", "590", null),
      row("butter", "565", null),
      row("semi-skimmed milk", "210", null),
      row("flour T45", "525", null),
      row("baking powder", "25", null),
      row("honey", "60", null),
      row("oil", "40", null),
      row("gfleur de sel", "3", null),
      row("vanilla pod", "5", null),
      row("Chocolate white", "1600", "gr"),
      row("green color", "10", "gr"),
    ],
  },
  {
    sourceId: "pastry-national-day-cake",
    name: "National Day Cake",
    suggestedProductName: "National Day Cake",
    outputQuantity: null,
    outputUnit: null,
    rawSourceText: "\nMousse :\n375 milk \n75 egg\n90 gelatine \n900 chocolate milk\n900 cream Elle est vire\nSponge :\n1000 Dwn \n220 water \n300 oil \n350 egg\nGanache :\n400 cream Elle est vire \n300 chocolate milk white\n\nINGREDIENTS:   \n Green color 5gr",
    ingredients: [
      row("milk", "375", null),
      row("egg", "75", null),
      row("gelatine", "90", null),
      row("chocolate milk", "900", null),
      row("cream Elle est vire", "900", null),
      row("Dwn", "1000", null),
      row("water", "220", null),
      row("oil", "300", null),
      row("egg", "350", null),
      row("cream Elle est vire", "400", null),
      row("chocolate milk white", "300", null),
      row("green color", "5", "gr"),
    ],
  },
] as const;

const PRODUCT_ALIASES: Record<string, string[]> = {
  "bb cake": ["b b cake"],
  "b b cake": ["bb cake"],
  "choclate cookies": ["chocolate cookies"],
  "choclate matilda": ["chocolate matilda"],
  "madrid cheeseca": ["madrid cheesecake"],
  "madeline biscuit": ["madeleine biscuit"],
  "mini honey cake box": ["mini honey cake"],
};

/*
 * Aliases here are explicit catalog aliases, not fuzzy matching.  In
 * particular, no cream alias is declared and egg whites/yolks are kept out
 * of the whole-egg alias group.
 */
const MATERIAL_ALIASES: Record<string, string[]> = {
  "egg": ["eggs", "whole egg"],
  "eggs": ["egg", "whole egg"],
  "egg whole": ["whole egg", "egg"],
  "whole egg": ["egg", "eggs"],
  "gelatine": ["gelatin"],
  "gelatin": ["gelatine"],
  "chocolate dark": ["dark chocolate"],
  "dark chocolate": ["chocolate dark"],
  "chocolate white": ["white chocolate"],
  "milk chocolate": ["chocolate milk"],
  "chocolate milk": ["milk chocolate"],
  "chocolat milk": ["milk chocolate", "chocolate milk"],
  "flour t45": ["flour 45", "flour-45"],
  "flour 45": ["flour t45", "flour-45"],
  "flour-45": ["flour t45", "flour 45"],
  "ising sugar": ["icing sugar"],
  "icing sugar": ["ising sugar"],
  "corn flour": ["cornflour"],
  "cornflour": ["corn flour"],
  "baking soda": ["sodium bicarbonate"],
  "baking powder": ["baking powder"],
};

const NO_SAFE_MATERIAL_MATCH = new Set([
  "cream",
  "cremeux caramel",
  "liquide cream",
  "cream liquid",
  "crem",
  "cream elle and vire",
  "whipping cream",
  "cream whipping",
  "egg whites",
  "egg white",
  "egg yolk",
  "egg yolks",
]);

const CONFIRMED_TARGET_UNIT_BY_NAME: Record<string, string> = {
  egg: "piece",
  eggs: "piece",
  "egg whole": "piece",
  "whole egg": "piece",
  "egg yellow": "piece",
  "egg yolk": "piece",
  "egg yolks": "piece",
  "egg white": "piece",
  "egg whites": "piece",
  cream: "litre",
  "liquide cream": "litre",
  "cream liquid": "litre",
  "whipping cream": "litre",
  "cream whipping": "litre",
  "cream elle and vire": "litre",
  milk: "litre",
  oil: "litre",
  "digestive biscuits": "kg",
};

function normalizedUnit(rawUnit: string | null): string | null {
  if (!rawUnit) return null;
  const unit = rawUnit.trim().toLocaleLowerCase("en-US").replace(/\.$/, "");
  if (["g", "gr", "gram", "grams"].includes(unit)) return "kg";
  if (unit === "kg") return "kg";
  if (["pc", "pcs", "piece", "pieces"].includes(unit)) return "piece";
  if (["box", "boxes"].includes(unit)) return "box";
  return null;
}

function numberFromRawQuantity(rawQuantity: string | null): number | null {
  if (!rawQuantity || !/^\d+(?:\.\d+)?$/.test(rawQuantity.trim())) return null;
  const value = Number(rawQuantity);
  return Number.isFinite(value) ? value : null;
}

function parseQuantity(
  sourceIngredient: CentralKitchenRecipeImportSourceIngredient,
): { quantity: number | null; unit: string | null; issue: string | null } {
  const nameKey = normalizeCentralKitchenRecipeImportName(sourceIngredient.rawName);
  const expectedUnit = CONFIRMED_TARGET_UNIT_BY_NAME[nameKey];
  const parsedValue = numberFromRawQuantity(sourceIngredient.rawQuantity);
  const parsedUnit = normalizedUnit(sourceIngredient.rawUnit);

  if (parsedValue === null) {
    return {
      quantity: null,
      unit: null,
      issue: unresolved("source quantity is missing or not numeric; acknowledge/correct before save"),
    };
  }
  if (!parsedUnit) {
    return {
      quantity: null,
      unit: null,
      issue: unresolved("source unit is missing or unknown; do not infer it"),
    };
  }
  if (expectedUnit && parsedUnit !== expectedUnit) {
    return {
      quantity: null,
      unit: null,
      issue: unresolved(`source unit ${sourceIngredient.rawUnit} cannot be converted to confirmed catalog unit ${expectedUnit}`),
    };
  }
  const quantity = parsedUnit === "kg" && ["g", "gr", "gram", "grams"].includes(
    (sourceIngredient.rawUnit || "").trim().toLocaleLowerCase("en-US").replace(/\.$/, ""),
  ) ? parsedValue / 1000 : parsedValue;
  return { quantity, unit: parsedUnit, issue: null };
}

function findProductSuggestion(
  source: CentralKitchenRecipeImportSource,
  products: CentralKitchenRecipeImportCatalogItem[],
): { productId: number | null; issue: string | null } {
  // Madrid is known to have two variants.  Madeleine and National Day were
  // intentionally not matched in the initial import, even if a future
  // catalog happens to contain a similarly named item.
  if (source.sourceId === "pastry-madrid-cheeseca") {
    return {
      productId: null,
      issue: unresolved("Madrid has two product variants; select a product explicitly"),
    };
  }
  if (
    source.sourceId === "pastry-madeline-biscuit"
    || source.sourceId === "pastry-national-day-cake"
  ) {
    return {
      productId: null,
      issue: unresolved("no safe product catalog match; select a product explicitly"),
    };
  }
  const matches = findStrictCentralKitchenRecipeImportMatches(
    source.suggestedProductName,
    products,
    PRODUCT_ALIASES,
  );
  if (matches.length === 1) return { productId: matches[0].id, issue: null };
  return {
    productId: null,
    issue: unresolved(
      matches.length > 1
        ? "product match is ambiguous; select a product explicitly"
        : "no strict product catalog match; select a product explicitly",
    ),
  };
}

function findMaterialSuggestion(
  sourceName: string,
  materials: CentralKitchenRecipeImportCatalogItem[],
): { warehouseItemId: number | null; issue: string | null } {
  const sourceKey = normalizeCentralKitchenRecipeImportName(sourceName);
  if (NO_SAFE_MATERIAL_MATCH.has(sourceKey)) {
    return {
      warehouseItemId: null,
      issue: unresolved("ingredient type is uncertain; no generic substitution is suggested"),
    };
  }
  const matches = findStrictCentralKitchenRecipeImportMatches(
    sourceName,
    materials,
    MATERIAL_ALIASES,
  );
  if (matches.length === 1) return { warehouseItemId: matches[0].id, issue: null };
  return {
    warehouseItemId: null,
    issue: unresolved(
      matches.length > 1
        ? "ingredient match is ambiguous; select a catalog material explicitly"
        : "no strict catalog material match",
    ),
  };
}

function outputUnitForSource(source: CentralKitchenRecipeImportSource): string | null {
  return source.outputUnit;
}

export function mapPastryRecipeImportSources(
  catalog: CentralKitchenRecipeImportCatalog,
): CentralKitchenRecipeImportContract[] {
  return PASTRY_RECIPE_IMPORT_SOURCES.map((source) => {
    const productSuggestion = findProductSuggestion(source, catalog.products);
    const ingredients = source.ingredients.map((rawIngredient) => {
      const parsed = parseQuantity(rawIngredient);
      const materialSuggestion = findMaterialSuggestion(rawIngredient.rawName, catalog.materials);
      const issue = [
        rawIngredient.issue && unresolved(rawIngredient.issue),
        parsed.issue,
        materialSuggestion.issue,
      ].filter(Boolean).join("; ") || null;
      return {
        sourceName: rawIngredient.rawName,
        sourceQuantity: rawIngredient.rawQuantity || "",
        sourceUnit: rawIngredient.rawUnit || "",
        warehouseItemId: materialSuggestion.warehouseItemId,
        quantity: parsed.quantity,
        unit: parsed.unit,
        issue,
      };
    });
    const issues = [
      productSuggestion.issue,
      source.outputQuantity === null
        ? unresolved("source yield is missing; acknowledge/correct before save")
        : null,
      ...ingredients.map((ingredient) => ingredient.issue),
      ...(source.issues || []),
    ].filter((issue): issue is string => Boolean(issue));
    return {
      sourceId: source.sourceId,
      name: source.name,
      suggestedProductName: source.suggestedProductName,
      outputQuantity: source.outputQuantity,
      outputUnit: outputUnitForSource(source),
      rawSourceText: source.rawSourceText,
      productId: productSuggestion.productId,
      ingredients,
      issues: Array.from(new Set(issues)),
    };
  });
}
