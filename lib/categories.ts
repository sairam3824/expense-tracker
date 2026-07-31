// The category list is the single source of truth: the DB stores the label as
// plain text, the OpenAI prompt is built from these names, and the charts read
// their colors from here.
//
// Colors are a muted, paper-friendly categorical palette validated with the
// dataviz palette checker against this app's card surface (#faf8f0). With
// Cosmetics added there are nine hues plus a neutral "Other":
//   lightness band PASS · chroma floor PASS
//   worst adjacent CVD ΔE 9.4 (protan)
//   worst adjacent normal-vision ΔE 15.9 (Cosmetics vs Entertainment)
// That last figure clears the floor of 15 but only just, so the ORDER below is
// load-bearing — re-run the validator before reordering or adding a hue rather
// than picking a color by eye. Several candidate hues were rejected outright:
// teal and steel-blue fell under the chroma floor, brown collided with the
// Entertainment red (CVD ΔE 4.7).
//
// The one sub-3:1 slot (Transport ochre, 2.43:1) is relieved by direct labels —
// every category is always shown with its name and amount in text, never by
// color alone.

export type CategoryName =
  | "Groceries"
  | "Food & Dining"
  | "Shopping"
  | "Transport"
  | "Bills & Recharge"
  | "Health"
  | "Home"
  | "Entertainment"
  | "Cosmetics"
  | "Other";

export type Category = {
  name: CategoryName;
  color: string;
  /** Lowercase substrings used by the offline fallback classifier. */
  keywords: string[];
};

export const CATEGORIES: Category[] = [
  {
    name: "Groceries",
    color: "#1f6ea6",
    keywords: [
      "grocer", "vegetab", "veggie", "fruit", "milk", "curd", "egg", "rice",
      "dal", "atta", "oil", "sugar", "kirana", "bigbasket", "blinkit",
      "zepto", "dmart", "d-mart", "supermarket", "provision",
    ],
  },
  {
    name: "Food & Dining",
    color: "#c2622f",
    keywords: [
      "food", "lunch", "dinner", "breakfast", "brunch", "snack", "tea",
      "coffee", "chai", "restaurant", "hotel", "mess", "canteen", "swiggy",
      "zomato", "dominos", "pizza", "burger", "biryani", "juice", "bakery",
      // Longer than Cosmetics' "cream", so these win the longest-match rule.
      "ice cream", "icecream",
    ],
  },
  {
    name: "Shopping",
    color: "#2f8f6f",
    keywords: [
      "shirt", "t shirt", "tshirt", "short", "pant", "jean", "dress", "cloth",
      "shoe", "sandal", "slipper", "watch", "bag", "amazon", "flipkart",
      "myntra", "ajio", "meesho", "electronics", "gadget", "headphone",
    ],
  },
  {
    name: "Transport",
    color: "#c99a1e",
    keywords: [
      "petrol", "diesel", "fuel", "bus", "train", "metro", "auto", "cab",
      "taxi", "uber", "ola", "rapido", "ticket", "flight", "toll", "parking",
      "irctc", "travel",
    ],
  },
  {
    name: "Bills & Recharge",
    color: "#b5678f",
    keywords: [
      "recharge", "data", "mobile", "phone bill", "jio", "airtel", "vi",
      "bsnl", "electricity", "current bill", "water bill", "gas", "cylinder",
      "broadband", "wifi", "internet", "dth", "bill", "emi", "insurance",
      "premium", "subscription", "netflix", "spotify", "prime",
    ],
  },
  {
    name: "Health",
    color: "#4a7a2f",
    keywords: [
      "medicine", "medical", "tablet", "pharmacy", "apollo", "doctor",
      "hospital", "clinic", "test", "scan", "dental", "dentist", "gym",
      "checkup", "health",
    ],
  },
  {
    name: "Home",
    color: "#6a5aa8",
    keywords: [
      "rent", "room", "cleaning", "maid", "repair", "furniture", "utensil",
      "soap", "detergent", "brush", "paste", "toiletries", "tissue",
      "household", "maintenance", "deposit",
    ],
  },
  {
    name: "Entertainment",
    color: "#a63a2f",
    keywords: [
      "movie", "cinema", "theatre", "pvr", "inox", "game", "gaming", "outing",
      "trip", "party", "concert", "event", "book", "hobby",
    ],
  },
  {
    name: "Cosmetics",
    color: "#c2559a",
    keywords: [
      "cosmetic", "makeup", "make up", "lipstick", "kajal", "eyeliner",
      "mascara", "foundation", "compact", "nail polish", "perfume", "deodorant",
      "deo", "face wash", "facewash", "moisturiser", "moisturizer", "cream",
      "lotion", "serum", "sunscreen", "salon", "parlour", "parlor", "beauty",
      // Grooming rather than household supplies — matches how the model
      // classifies it, so both paths agree.
      "shampoo", "conditioner",
    ],
  },
  {
    // Neutral gray on purpose — "Other" is the fold-the-tail bucket, so it must
    // not compete with a real category for attention.
    name: "Other",
    color: "#8a8272",
    keywords: [],
  },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

const BY_NAME = new Map<string, Category>(CATEGORIES.map((c) => [c.name, c]));

export function categoryColor(name: string): string {
  return BY_NAME.get(name)?.color ?? "#8a8272";
}

export function isCategory(value: unknown): value is CategoryName {
  return typeof value === "string" && BY_NAME.has(value);
}

/**
 * Offline classifier. Used when no OpenAI key is configured, and as the
 * fallback whenever the API call fails or times out — so logging an entry
 * never depends on the network.
 *
 * Longer keywords win, so "phone bill" beats "phone" and "t shirt" beats
 * a stray "shirt" elsewhere in the string.
 */
export function guessCategory(expense: string): CategoryName {
  const text = expense.toLowerCase();
  let best: { name: CategoryName; length: number } | null = null;

  for (const category of CATEGORIES) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { name: category.name, length: keyword.length };
      }
    }
  }

  return best?.name ?? "Other";
}
