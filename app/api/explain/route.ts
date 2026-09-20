import { APICallError, generateText } from "ai";
import { z } from "zod";

import { MissingApiKeyError, getModel } from "@/lib/ai";
import { EXPLAIN_TYPES, type ExplainType } from "@/types";

export const maxDuration = 30;

const requestSchema = z.object({
  term: z.string().trim().min(1).max(400),
  explainType: z.enum(EXPLAIN_TYPES),
  context: z.string().max(2000).optional(),
});

const SYSTEM_PROMPT = `You explain lecture-slide terminology to a university student who is seeing it for the first time.

Write plain prose. No markdown headings, no bullet lists, no bold, no preamble like "Sure" or "This term refers to". Start with the substance. Never mention the slide or the context you were given.`;

const INSTRUCTIONS: Record<ExplainType, string> = {
  base: "Explain what it means in two or three sentences. Define it first, then say why it matters.",
  example:
    "Give one concrete, specific example of it in use. Two or three sentences. Prefer a real case over a hypothetical one.",
  analogy:
    "Give one everyday analogy that makes it intuitive, then name where the analogy breaks down. Three sentences at most.",
  elaborate:
    "Go one level deeper than a basic definition: the mechanism, the assumptions it relies on, or the common misconception about it. Four sentences at most.",
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { term, explainType, context } = parsed.data;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: SYSTEM_PROMPT,
      prompt: [
        `Term: ${term}`,
        context ? `Slide context:\n${context}` : null,
        INSTRUCTIONS[explainType],
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    return Response.json({ text: text.trim() });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      return Response.json(
        {
          error:
            "Your Gemini plan's rate limit was reached. Wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    console.error(
      "explain failed:",
      error instanceof Error ? error.message : error,
    );
    return Response.json(
      { error: "Failed to generate an explanation." },
      { status: 502 },
    );
  }
}
