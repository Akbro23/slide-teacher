// Writes tmp/sample-slides.pdf: a tiny, text-based lecture deck for exercising
// the viewer, the text-position extraction, and the dot overlay without
// needing a real PDF to hand.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SLIDES = [
  {
    title: "Gradient Descent",
    lines: [
      "An iterative optimisation algorithm.",
      "The learning rate controls step size.",
      "Convergence depends on the loss surface.",
    ],
  },
  {
    title: "Backpropagation",
    lines: [
      "Applies the chain rule to compute gradients.",
      "Reverse-mode automatic differentiation.",
      "Vanishing gradients affect deep networks.",
    ],
  },
  {
    title: "Regularisation",
    lines: [
      "L2 weight decay penalises large weights.",
      "Dropout randomly zeroes activations.",
      "Both reduce overfitting on small datasets.",
    ],
  },
];

const WIDTH = 720;
const HEIGHT = 540;

const escape = (text) => text.replace(/([\\()])/g, "\\$1");

function contentStream({ title, lines }) {
  const body = lines
    .map(
      (line, index) =>
        `BT /F1 20 Tf 60 ${HEIGHT - 170 - index * 46} Td (${escape(line)}) Tj ET`,
    )
    .join("\n");

  return `BT /F1 34 Tf 60 ${HEIGHT - 90} Td (${escape(title)}) Tj ET\n${body}\n`;
}

const objects = [];
const pageObjectNumbers = SLIDES.map((_, index) => 3 + index * 2);

objects.push("<< /Type /Catalog /Pages 2 0 R >>");
objects.push(
  `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(" ")}] /Count ${SLIDES.length} >>`,
);

const fontObjectNumber = 3 + SLIDES.length * 2;

for (const [index, slide] of SLIDES.entries()) {
  const contents = contentStream(slide);
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> ` +
      `/Contents ${4 + index * 2} 0 R >>`,
  );
  objects.push(
    `<< /Length ${Buffer.byteLength(contents)} >>\nstream\n${contents}endstream`,
  );
}

objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

let pdf = "%PDF-1.4\n";
const offsets = [];

for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}

const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
}
pdf +=
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
  `startxref\n${xrefOffset}\n%%EOF\n`;

const target = join(process.cwd(), "tmp");
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "sample-slides.pdf"), pdf, "latin1");

console.log(`Wrote tmp/sample-slides.pdf (${SLIDES.length} slides)`);
