import "server-only";

import { CATEGORY_NAMES, guessCategory, isCategory } from "./categories";
import type { CategoryName } from "./categories";

// Asks OpenAI which category an expense description belongs to, and falls back
// to local keyword matching whenever that isn't possible — no key, an API
// error, a timeout, or an answer that isn't one of our categories. Logging an
// expense must never block on the network, so the fallback is the normal path,
// not an error path.

const TIMEOUT_MS = 4000;
const MODEL = "gpt-4o-mini";

// The bare category list alone sends borderline items to "Other" (e.g. "Room
// cleaning" landed there rather than Home), so each one carries a short scope
// note. Keep these in sync with the keyword lists in categories.ts.
const CATEGORY_GUIDE = [
  "Groceries — food and provisions bought to cook or keep at home, supermarkets, quick-commerce",
  "Food & Dining — meals and drinks bought ready to eat: restaurants, mess, canteen, delivery, tea, coffee",
  "Shopping — clothes, footwear, accessories, electronics, general online orders",
  "Transport — fuel, bus, train, metro, autos, cabs, flights, tolls, parking",
  "Bills & Recharge — mobile/data recharge, electricity, water, gas, broadband, DTH, EMIs, insurance, subscriptions",
  "Health — medicines, pharmacy, doctor, hospital, tests, dental, gym",
  "Home — rent, deposits, room cleaning, maid, repairs, furniture, utensils, toiletries and household supplies",
  "Entertainment — films, outings, trips, parties, games, events, books, hobbies",
  "Cosmetics — make-up, skincare, fragrance, grooming products, salon and parlour visits",
  "Other — anything that genuinely fits none of the above",
].join("\n");

export type CategoryGuess = {
  category: CategoryName;
  /** Where the answer came from, surfaced in the UI as a subtle hint. */
  source: "openai" | "keywords";
};

export async function classifyExpense(
  expense: string
): Promise<CategoryGuess> {
  const text = expense.trim();
  if (!text) return { category: "Other", source: "keywords" };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { category: guessCategory(text), source: "keywords" };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content:
              "You categorise personal expenses for an Indian household budget.\n\n" +
              `${CATEGORY_GUIDE}\n\n` +
              "Reply with exactly one category name from the list above and nothing else. " +
              'Prefer a specific category over "Other" whenever one plausibly applies.',
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);

    const body = await response.json();
    const answer: string = (body?.choices?.[0]?.message?.content ?? "").trim();

    if (isCategory(answer)) return { category: answer, source: "openai" };

    // Tolerate case and punctuation drift before giving up on the model.
    const normalised = CATEGORY_NAMES.find(
      (name) => name.toLowerCase() === answer.toLowerCase().replace(/[."']/g, "")
    );
    if (normalised) return { category: normalised, source: "openai" };

    throw new Error(`Unrecognised category "${answer}"`);
  } catch (error) {
    console.warn(
      "Category lookup fell back to keywords:",
      error instanceof Error ? error.message : error
    );
    return { category: guessCategory(text), source: "keywords" };
  }
}
