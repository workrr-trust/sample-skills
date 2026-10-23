"use strict";

// Genuine 42-check deterministic test suite for the pdf-extract skill.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  decodePdfLiteralString,
  decodePdfHexString,
  parsePageRange,
  extractInfoMetadata,
  extractTextRunsFromStream,
  groupRunsIntoRows,
  extractPdfDocument,
} = require("./extract.cjs");

const skillMd = fs.readFileSync(path.join(__dirname, "SKILL.md"), "utf8");
const workrrJson = JSON.parse(fs.readFileSync(path.join(__dirname, "workrr.json"), "utf8"));

const SAMPLE_PDF = [
  "%PDF-1.7",
  "1 0 obj",
  "<< /Title (Quarterly Revenue Report) /Author (Finance Ops) /Subject <4175646974> /CreationDate (D:20261016090000Z) >>",
  "endobj",
  "2 0 obj",
  "<< /Length 180 >>",
  "stream",
  "BT",
  "72 720 Td",
  "(Region) Tj",
  "140 0 Td",
  "(Q3 Revenue) Tj",
  "-140 -20 Td",
  "(North America) Tj",
  "140 0 Td",
  "($1,240,000) Tj",
  "ET",
  "endstream",
  "endobj",
  "3 0 obj",
  "<< /Length 120 >>",
  "stream",
  "BT",
  "1 0 0 1 72 700 Tm",
  "[(Exec) -220 (Summary)] TJ",
  "0 -24 Td",
  "<4f4b> Tj",
  "ET",
  "endstream",
  "endobj",
  "%%EOF",
].join("\n");

const checks = [
  // 1–6: SKILL.md frontmatter and structure checks
  ["SKILL.md has YAML frontmatter delimiter", () => assert.match(skillMd, /^---\n[\s\S]+?\n---\n/)],
  ["SKILL.md declares name: pdf-extract", () => assert.match(skillMd, /^name:\s*pdf-extract$/m)],
  ["SKILL.md description states when to use", () => assert.match(skillMd, /^description:.*Use when/m)],
  ["SKILL.md declares license: Apache-2.0", () => assert.match(skillMd, /^license:\s*Apache-2\.0$/m)],
  ["SKILL.md scopes allowed-tools to Read", () => assert.match(skillMd, /^allowed-tools:\s*Read$/m)],
  ["SKILL.md contains numbered procedural steps 1..4", () => {
    for (const n of [1, 2, 3, 4]) assert.match(skillMd, new RegExp(`^${n}\\.\\s+`, "m"));
  }],

  // 7–8: workrr.json and module exports
  ["workrr.json declares node check.cjs command", () => assert.equal(workrrJson.test.command, "node check.cjs")],
  ["extract.cjs exports all 7 functions", () => {
    for (const fn of [
      decodePdfLiteralString,
      decodePdfHexString,
      parsePageRange,
      extractInfoMetadata,
      extractTextRunsFromStream,
      groupRunsIntoRows,
      extractPdfDocument,
    ]) {
      assert.equal(typeof fn, "function");
    }
  }],

  // 9–16: PDF literal string decoding
  ["decodePdfLiteralString returns plain text unchanged", () => {
    assert.equal(decodePdfLiteralString("Hello PDF"), "Hello PDF");
  }],
  ["decodePdfLiteralString decodes \\n, \\r, \\t escapes", () => {
    assert.equal(decodePdfLiteralString("a\\nb\\rc\\td"), "a\nb\rc\td");
  }],
  ["decodePdfLiteralString decodes \\b and \\f escapes", () => {
    assert.equal(decodePdfLiteralString("x\\by\\fz"), "x\by\fz");
  }],
  ["decodePdfLiteralString decodes escaped parentheses and backslashes", () => {
    assert.equal(decodePdfLiteralString("\\(total \\\\ $100\\)"), "(total \\ $100)");
  }],
  ["decodePdfLiteralString decodes 3-digit octal character codes", () => {
    assert.equal(decodePdfLiteralString("\\101\\102\\103"), "ABC");
  }],
  ["decodePdfLiteralString decodes 1- and 2-digit octal codes", () => {
    assert.equal(decodePdfLiteralString("\\53\\7"), "+\x07");
  }],
  ["decodePdfLiteralString drops unknown escape backslashes cleanly", () => {
    assert.equal(decodePdfLiteralString("\\q"), "q");
  }],
  ["decodePdfLiteralString handles trailing backslash without throwing", () => {
    assert.equal(decodePdfLiteralString("abc\\"), "abc");
  }],

  // 17–22: PDF hex string decoding
  ["decodePdfHexString decodes ASCII hex bytes", () => {
    assert.equal(decodePdfHexString("4175646974"), "Audit");
  }],
  ["decodePdfHexString ignores embedded whitespace", () => {
    assert.equal(decodePdfHexString("48 65 6c 6c 6f"), "Hello");
  }],
  ["decodePdfHexString pads odd-length hex strings per PDF spec", () => {
    assert.equal(decodePdfHexString("412"), "A ");
  }],
  ["decodePdfHexString decodes UTF-16BE with FEFF BOM", () => {
    assert.equal(decodePdfHexString("FEFF00480069"), "Hi");
  }],
  ["decodePdfHexString handles empty hex string", () => {
    assert.equal(decodePdfHexString(""), "");
  }],
  ["decodePdfHexString throws on non-hex characters", () => {
    assert.throws(() => decodePdfHexString("41ZZ"), /Invalid hex string/);
  }],

  // 23–29: Page range parsing
  ["parsePageRange returns all pages when spec is empty", () => {
    assert.deepEqual(parsePageRange("", 4), [1, 2, 3, 4]);
  }],
  ["parsePageRange returns all pages when spec is 'all'", () => {
    assert.deepEqual(parsePageRange("all", 3), [1, 2, 3]);
  }],
  ["parsePageRange parses single page numbers and deduplicates", () => {
    assert.deepEqual(parsePageRange("3, 1, 3", 5), [1, 3]);
  }],
  ["parsePageRange parses inclusive page ranges", () => {
    assert.deepEqual(parsePageRange("2-4,6", 6), [2, 3, 4, 6]);
  }],
  ["parsePageRange throws when page exceeds totalPages", () => {
    assert.throws(() => parsePageRange("1-5", 4), RangeError);
  }],
  ["parsePageRange throws when range start > end", () => {
    assert.throws(() => parsePageRange("4-2", 5), RangeError);
  }],
  ["parsePageRange throws on non-numeric range token", () => {
    assert.throws(() => parsePageRange("one-two", 5), /Malformed page range/);
  }],

  // 30–35: Info dictionary and content stream extraction
  ["extractInfoMetadata extracts literal and hex metadata fields", () => {
    const info = extractInfoMetadata(SAMPLE_PDF);
    assert.equal(info.Title, "Quarterly Revenue Report");
    assert.equal(info.Author, "Finance Ops");
    assert.equal(info.Subject, "Audit");
    assert.equal(info.CreationDate, "D:20261016090000Z");
  }],
  ["extractTextRunsFromStream extracts Td-positioned Tj strings", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.equal(doc.pages[0].runs.length, 4);
    assert.equal(doc.pages[0].runs[0].text, "Region");
    assert.equal(doc.pages[0].runs[1].text, "Q3 Revenue");
  }],
  ["extractTextRunsFromStream decodes TJ kerning arrays with word spacing", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.equal(doc.pages[1].runs[0].text, "Exec Summary");
  }],
  ["extractTextRunsFromStream decodes hex Tj operators", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.equal(doc.pages[1].runs[1].text, "OK");
  }],
  ["groupRunsIntoRows aligns columns by baseline y and sorts left-to-right by x", () => {
    const rows = groupRunsIntoRows([
      { x: 200, y: 500, text: "Col2" },
      { x: 72, y: 500.5, text: "Col1" },
      { x: 72, y: 480, text: "Row2Col1" },
    ]);
    assert.deepEqual(rows, [["Col1", "Col2"], ["Row2Col1"]]);
  }],
  ["groupRunsIntoRows returns empty array when given no runs", () => {
    assert.deepEqual(groupRunsIntoRows([]), []);
  }],

  // 36–42: Full document extraction & determinism
  ["extractPdfDocument parses PDF version", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.equal(doc.version, "1.7");
  }],
  ["extractPdfDocument counts all content stream pages", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.equal(doc.pageCount, 2);
  }],
  ["extractPdfDocument reconstructs table rows on page 1", () => {
    const doc = extractPdfDocument(SAMPLE_PDF);
    assert.deepEqual(doc.pages[0].rows, [
      ["Region", "Q3 Revenue"],
      ["North America", "$1,240,000"],
    ]);
  }],
  ["extractPdfDocument filters pages when options.pages is provided", () => {
    const doc = extractPdfDocument(SAMPLE_PDF, { pages: "2" });
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].pageNumber, 2);
    assert.equal(doc.pages[0].text, "Exec Summary\nOK");
  }],
  ["extractPdfDocument rejects input without %PDF- header", () => {
    assert.throws(() => extractPdfDocument("NOT A PDF"), /Invalid PDF header/);
  }],
  ["extractPdfDocument handles PDF with no content streams", () => {
    const doc = extractPdfDocument("%PDF-1.4\n%%EOF");
    assert.equal(doc.version, "1.4");
    assert.equal(doc.pageCount, 0);
  }],
  ["extractPdfDocument is byte-for-byte deterministic across runs", () => {
    const a = JSON.stringify(extractPdfDocument(SAMPLE_PDF));
    const b = JSON.stringify(extractPdfDocument(SAMPLE_PDF));
    assert.equal(a, b);
  }],
];

assert.equal(checks.length, 42, `expected exactly 42 checks, found ${checks.length}`);

let passed = 0;
for (let i = 0; i < checks.length; i++) {
  const [name, fn] = checks[i];
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL [${i + 1}/42] ${name}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`pdf-extract: ${passed}/${checks.length} checks pass`);
