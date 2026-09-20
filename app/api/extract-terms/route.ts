import { APICallError, NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";

import { MissingApiKeyError, getModel } from "@/lib/ai";

export const maxDuration = 60;

/** Guard against a 400-page deck turning into an unbounded number of calls. */
const MAX_PAGES = 60;
const MAX_ITEMS_PER_PAGE = 200;
const MAX_TERMS_PER_PAGE = 6;

/**
 * Slides are marked several pages per request. One request per page is the
 * obvious design and the wrong one: Gemini's free tier allows a handful of
 * requests per minute, so a 30-page deck would spend the whole minute's budget
 * before finishing. Batching trades a slightly harder prompt for ~10x fewer calls.
 */
const PAGES_PER_BATCH = 10;
const CONCURRENCY = 2;

const requestSchema = z.object({
  pages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        items: z.array(z.object({ index: z.number().int(), text: z.string() })),
      }),
    )
    .min(1),
});

const termsSchema = z.object({
  terms: z.array(
    z.object({
      page: z.number().int().describe("The slide number the term appears on."),
      term: z
        .string()
        .describe(
          "The key term exactly as it appears on the slide, at most four words.",
        ),
      itemIndex: z
        .number()
        .int()
        .describe(
          "Index of the numbered text run on that slide where the term starts. Must be one of the listed indices.",
        ),
    }),
  ),
});

type RequestPage = z.infer<typeof requestSchema>["pages"][number];
type TermHit = { page: number; term: string; itemIndex: number };

const SYSTEM_PROMPT = `You mark up lecture slides for students.

You are given the numbered text runs of several slides. For each slide, pick the terms a student is most likely to not understand: technical vocabulary, named concepts, methods, acronyms, and domain jargon.

Rules:
- Never pick slide titles, section headings, page numbers, dates, author names, or course codes.
- Never pick common English words or phrases that carry no domain meaning.
- At most ${MAX_TERMS_PER_PAGE} terms per slide. Fewer is better than padding with weak ones.
- If a slide has no terms worth explaining, return nothing for it.
- page and itemIndex must be copied from the input, never invented.`;

function buildPrompt(pages: RequestPage[]): string {
  return pages
    .map((page) => {
      const runs = page.items
        .slice(0, MAX_ITEMS_PER_PAGE)
        .map((item) => `${item.index}: ${item.text.slice(0, 120)}`)
        .join("\n");

      return `--- Slide ${page.page} ---\n${runs}`;
    })
    .join("\n\n");
}

async function extractBatchTerms(pages: RequestPage[]): Promise<TermHit[]> {
  const { output } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(pages),
    output: Output.object({ schema: termsSchema }),
  });

  // Indices are only meaningful per page, so validity is checked per page.
  const validIndices = new Map(
    pages.map((page) => [page.page, new Set(page.items.map((i) => i.index))]),
  );
  const perPageCount = new Map<number, number>();
  const hits: TermHit[] = [];

  for (const candidate of output.terms) {
    const term = candidate.term.trim();
    if (!term) continue;
    if (!validIndices.get(candidate.page)?.has(candidate.itemIndex)) continue;

    const used = perPageCount.get(candidate.page) ?? 0;
    if (used >= MAX_TERMS_PER_PAGE) continue;
    perPageCount.set(candidate.page, used + 1);

    hits.push({ page: candidate.page, term, itemIndex: candidate.itemIndex });
  }

  return hits;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/** Fixed-size worker pool, sized to stay inside per-minute request quotas. */
async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R[]>,
): Promise<{ results: R[]; firstError: unknown }> {
  const collected: R[][] = values.map(() => []);
  let cursor = 0;
  let firstError: unknown = null;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      try {
        collected[index] = await fn(values[index]);
      } catch (error) {
        if (error instanceof MissingApiKeyError) throw error;
        // A batch that fails shouldn't cost the whole document, but the reason
        // is surfaced if nothing at all came back.
        firstError ??= error;
        console.error(
          `extract-terms: batch ${index + 1} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, worker),
  );

  return { results: collected.flat(), firstError };
}

function describeError(error: unknown): { message: string; status: number } {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return {
      message:
        "Your Gemini plan's rate limit was reached. Wait a minute and try again, or use a smaller PDF.",
      status: 429,
    };
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      message: "The model returned an unparseable response.",
      status: 502,
    };
  }
  return { message: "Failed to extract key terms.", status: 502 };
}

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

  const pages = parsed.data.pages
    .filter((page) => page.items.length > 0)
    .slice(0, MAX_PAGES);

  if (pages.length === 0) {
    return Response.json({ terms: [], truncatedAtPage: null });
  }

  try {
    const { results, firstError } = await mapWithConcurrency(
      chunk(pages, PAGES_PER_BATCH),
      CONCURRENCY,
      extractBatchTerms,
    );

    // Partial results are still useful; a total failure is worth reporting.
    if (results.length === 0 && firstError) {
      const { message, status } = describeError(firstError);
      return Response.json({ error: message }, { status });
    }

    return Response.json({
      terms: results,
      truncatedAtPage:
        parsed.data.pages.length > MAX_PAGES ? MAX_PAGES : null,
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.error("extract-terms failed", error);
    return Response.json(
      { error: "Failed to extract key terms." },
      { status: 500 },
    );
  }
}
