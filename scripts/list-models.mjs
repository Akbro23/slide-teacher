// Prints the Gemini model IDs the configured key can use, so a model can be
// chosen from the live list rather than from documentation that may lag.
// Usage: node --env-file=.env.local scripts/list-models.mjs [filter]
const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("No GEMINI_API_KEY found. Run with --env-file=.env.local");
  process.exit(1);
}

const filter = (process.argv[2] ?? "").toLowerCase();

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
  { headers: { "x-goog-api-key": apiKey } },
);

if (!response.ok) {
  console.error(`ListModels failed: ${response.status}`);
  process.exit(1);
}

const { models = [] } = await response.json();

const usable = models
  .filter((model) =>
    model.supportedGenerationMethods?.includes("generateContent"),
  )
  .map((model) => model.name.replace("models/", ""))
  .filter((id) => !filter || id.toLowerCase().includes(filter))
  .sort();

console.log(usable.join("\n"));
console.log(`\n${usable.length} model(s)`);
