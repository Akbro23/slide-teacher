import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Thrown before any network call so routes can return a actionable message
 * instead of a provider-shaped 401.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No AI provider API key found. Set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in .env.local.",
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * Pinned rather than the floating `gemini-flash-lite-latest` alias, so a model
 * revision can't silently change prompt behaviour.
 * `node --env-file=.env.local scripts/list-models.mjs` lists the alternatives.
 */
export const MODEL_ID = process.env.AI_MODEL ?? "gemini-3.5-flash-lite";

/**
 * Single place the provider is chosen. Swapping to another provider means
 * changing the two lines below — every route goes through `getModel()` and
 * only depends on the AI SDK's `LanguageModel` interface.
 *
 *   import { createOpenAI } from "@ai-sdk/openai";
 *   return createOpenAI({ apiKey })(MODEL_ID);
 */
export function getModel(): LanguageModel {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!apiKey) throw new MissingApiKeyError();

  return createGoogleGenerativeAI({ apiKey })(MODEL_ID);
}
