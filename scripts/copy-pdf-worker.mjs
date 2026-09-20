// pdf.js loads its worker, character maps, and standard fonts over HTTP rather
// than through the bundler. Copying them out of node_modules at dev/build time
// keeps public/pdfjs in sync with the installed pdfjs-dist version, which must
// match the copy react-pdf resolves.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join(process.cwd(), "public", "pdfjs");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(
  join(pdfjsRoot, "build", "pdf.worker.min.mjs"),
  join(target, "pdf.worker.min.mjs"),
);
// cmaps render CJK text; standard_fonts substitute the 14 base PDF fonts.
cpSync(join(pdfjsRoot, "cmaps"), join(target, "cmaps"), { recursive: true });
cpSync(join(pdfjsRoot, "standard_fonts"), join(target, "standard_fonts"), {
  recursive: true,
});

console.log("pdf.js assets copied to public/pdfjs");
