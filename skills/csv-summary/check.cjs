"use strict";

// Genuine 42-check deterministic test suite for the csv-summary skill.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseCsv, classifyValue, summarizeCsv, formatMarkdownTable } = require("./summarize.cjs");

const skillMd = fs.readFileSync(path.join(__dirname, "SKILL.md"), "utf8");
const workrrJson = JSON.parse(fs.readFileSync(path.join(__dirname, "workrr.json"), "utf8"));

const checks = [
  // 1–6: SKILL.md frontmatter and structure checks
  ["SKILL.md has YAML frontmatter delimiter", () => assert.match(skillMd, /^---\n[\s\S]+?\n---\n/)],
  ["SKILL.md declares name: csv-summary", () => assert.match(skillMd, /^name:\s*csv-summary$/m)],
  ["SKILL.md description states when to use", () => assert.match(skillMd, /^description:.*Use when/m)],
  ["SKILL.md declares license: Apache-2.0", () => assert.match(skillMd, /^license:\s*Apache-2\.0$/m)],
  ["SKILL.md scopes allowed-tools to Read", () => assert.match(skillMd, /^allowed-tools:\s*Read$/m)],
  ["SKILL.md contains numbered procedural steps", () => {
    for (const n of [1, 2, 3, 4]) assert.match(skillMd, new RegExp(`^${n}\\.\\s+`, "m"));
  }],

  // 7–8: workrr.json test configuration
  ["workrr.json declares node check.cjs command", () => assert.equal(workrrJson.test.command, "node check.cjs")],
  ["summarize.cjs exports all 4 functions", () => {
    assert.equal(typeof parseCsv, "function");
    assert.equal(typeof classifyValue, "function");
    assert.equal(typeof summarizeCsv, "function");
    assert.equal(typeof formatMarkdownTable, "function");
  }],

  // 9–18: RFC 4180 CSV parser edge cases
  ["parseCsv returns empty array for empty string", () => assert.deepEqual(parseCsv(""), [])],
  ["parseCsv strips leading UTF-8 BOM", () => assert.deepEqual(parseCsv("\uFEFFa,b\n1,2"), [["a", "b"], ["1", "2"]])],
  ["parseCsv parses LF line endings", () => assert.deepEqual(parseCsv("a,b\n3,4\n"), [["a", "b"], ["3", "4"]])],
  ["parseCsv parses CRLF line endings", () => assert.deepEqual(parseCsv("a,b\r\n3,4\r\n"), [["a", "b"], ["3", "4"]])],
  ["parseCsv parses CR-only line endings", () => assert.deepEqual(parseCsv("a,b\r3,4"), [["a", "b"], ["3", "4"]])],
  ["parseCsv preserves commas inside quoted fields", () => {
    assert.deepEqual(parseCsv('id,note\n1,"hello, world"'), [["id", "note"], ["1", "hello, world"]]);
  }],
  ["parseCsv unescapes doubled quotes inside quoted fields", () => {
    assert.deepEqual(parseCsv('id,quote\n1,"He said ""hi"""'), [["id", "quote"], ["1", 'He said "hi"']]);
  }],
  ["parseCsv preserves newlines inside quoted fields", () => {
    assert.deepEqual(parseCsv('id,multiline\n1,"line 1\nline 2"'), [["id", "multiline"], ["1", "line 1\nline 2"]]);
  }],
  ["parseCsv throws on unterminated quoted field", () => {
    assert.throws(() => parseCsv('a,b\n1,"unterminated'), /Unterminated quoted field/);
  }],
  ["parseCsv rejects non-string input", () => {
    assert.throws(() => parseCsv(null), TypeError);
  }],

  // 19–26: Value classification
  ["classifyValue detects empty and whitespace-only strings", () => {
    assert.equal(classifyValue(""), "empty");
    assert.equal(classifyValue("   \t "), "empty");
  }],
  ["classifyValue detects integers and negatives", () => {
    assert.equal(classifyValue("42"), "number");
    assert.equal(classifyValue("-19"), "number");
  }],
  ["classifyValue detects decimals and scientific notation", () => {
    assert.equal(classifyValue("3.14159"), "number");
    assert.equal(classifyValue("-2.5e-4"), "number");
  }],
  ["classifyValue detects booleans case-insensitively", () => {
    assert.equal(classifyValue("true"), "boolean");
    assert.equal(classifyValue("FALSE"), "boolean");
  }],
  ["classifyValue detects ISO-8601 dates", () => {
    assert.equal(classifyValue("2026-10-22"), "date");
  }],
  ["classifyValue detects ISO-8601 timestamps with timezone", () => {
    assert.equal(classifyValue("2026-10-22T14:30:00Z"), "date");
  }],
  ["classifyValue treats invalid calendar dates as string", () => {
    assert.equal(classifyValue("2026-99-99"), "string");
  }],
  ["classifyValue treats alphanumeric identifiers as string", () => {
    assert.equal(classifyValue("SKU-1042"), "string");
  }],

  // 27–38: Column summary statistics
  ["summarizeCsv handles empty input", () => {
    assert.deepEqual(summarizeCsv(""), { rowCount: 0, columnCount: 0, columns: [] });
  }],
  ["summarizeCsv handles header-only CSV", () => {
    const s = summarizeCsv("id,amount\n");
    assert.equal(s.rowCount, 0);
    assert.equal(s.columnCount, 2);
    assert.equal(s.columns[0].type, "empty");
  }],
  ["summarizeCsv assigns fallback names to blank headers", () => {
    const s = summarizeCsv("id,,amount\n1,x,10\n");
    assert.equal(s.columns[1].name, "column_2");
  }],
  ["summarizeCsv computes numeric min, max, sum, and mean", () => {
    const s = summarizeCsv("score\n10\n20\n30\n40\n");
    const col = s.columns[0];
    assert.equal(col.type, "number");
    assert.equal(col.min, 10);
    assert.equal(col.max, 40);
    assert.equal(col.sum, 100);
    assert.equal(col.mean, 25);
  }],
  ["summarizeCsv handles negative and floating-point values accurately", () => {
    const s = summarizeCsv("delta\n-5.5\n0\n5.5\n");
    const col = s.columns[0];
    assert.equal(col.min, -5.5);
    assert.equal(col.max, 5.5);
    assert.equal(col.sum, 0);
    assert.equal(col.mean, 0);
  }],
  ["summarizeCsv ignores empty cells when inferring column type", () => {
    const s = summarizeCsv("price\n12.5\n\n7.5\n   \n");
    const col = s.columns[0];
    assert.equal(col.type, "number");
    assert.equal(col.emptyCount, 2);
    assert.equal(col.mean, 10);
  }],
  ["summarizeCsv downgrades mixed number+string columns to string", () => {
    const s = summarizeCsv("mixed\n100\nN/A\n200\n");
    const col = s.columns[0];
    assert.equal(col.type, "string");
    assert.equal(col.min, null);
    assert.equal(col.max, null);
  }],
  ["summarizeCsv counts unique non-empty values", () => {
    const s = summarizeCsv("status\nopen\nclosed\nopen\n\npending\n");
    const col = s.columns[0];
    assert.equal(col.uniqueCount, 3);
    assert.equal(col.emptyCount, 1);
  }],
  ["summarizeCsv treats missing trailing cells in ragged rows as empty", () => {
    const s = summarizeCsv("a,b,c\n1,2,3\n4\n");
    assert.equal(s.columns[1].emptyCount, 1);
    assert.equal(s.columns[2].emptyCount, 1);
  }],
  ["summarizeCsv supports custom tab delimiter", () => {
    const s = summarizeCsv("k\tv\nx\t10\ny\t20\n", { delimiter: "\t" });
    assert.equal(s.columnCount, 2);
    assert.equal(s.columns[1].sum, 30);
  }],
  ["summarizeCsv preserves Unicode text in column names and cells", () => {
    const s = summarizeCsv("مدينة,قيمة\nدبي,100\nأبوظبي,200\n");
    assert.equal(s.columns[0].name, "مدينة");
    assert.equal(s.columns[0].uniqueCount, 2);
    assert.equal(s.columns[1].mean, 150);
  }],
  ["summarizeCsv handles boolean columns", () => {
    const s = summarizeCsv("active\ntrue\nfalse\ntrue\n");
    assert.equal(s.columns[0].type, "boolean");
    assert.equal(s.columns[0].uniqueCount, 2);
  }],

  // 39–42: Markdown table formatting and determinism
  ["formatMarkdownTable renders header and separator rows", () => {
    const s = summarizeCsv("id,val\n1,10\n");
    const md = formatMarkdownTable(s);
    const lines = md.split("\n");
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^\|\s*Column\s*\|/);
    assert.match(lines[1], /^\|\s*---\s*\|/);
  }],
  ["formatMarkdownTable renders em-dash for non-numeric min/max/mean", () => {
    const s = summarizeCsv("name\nalice\nbob\n");
    const md = formatMarkdownTable(s);
    assert.match(md, /\|\s*name\s*\|\s*string\s*\|\s*2\s*\|\s*0\s*\|\s*2\s*\|\s*—\s*\|\s*—\s*\|\s*—\s*\|/);
  }],
  ["formatMarkdownTable renders numeric stats accurately", () => {
    const s = summarizeCsv("latency\n10\n30\n");
    const md = formatMarkdownTable(s);
    assert.match(md, /\|\s*latency\s*\|\s*number\s*\|\s*2\s*\|\s*0\s*\|\s*2\s*\|\s*10\s*\|\s*30\s*\|\s*20\s*\|/);
  }],
  ["summarizeCsv is byte-for-byte deterministic across repeated runs", () => {
    const input = 'id,label,amount,created\n1,"Alpha, Inc.",120.5,2026-10-01\n2,"Beta ""B""",79.5,2026-10-02\n3,,0,2026-10-03\n';
    const first = JSON.stringify(summarizeCsv(input));
    const second = JSON.stringify(summarizeCsv(input));
    assert.equal(first, second);
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

console.log(`csv-summary: ${passed}/${checks.length} checks pass`);
