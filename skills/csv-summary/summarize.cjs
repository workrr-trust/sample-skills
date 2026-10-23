"use strict";

// Deterministic RFC 4180 CSV parser and column profiler for the csv-summary skill.

function parseCsv(text, delimiter = ",") {
  if (typeof text !== "string") throw new TypeError("CSV input must be a string");
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (clean.length === 0) return [];

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Unterminated quoted field in CSV");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function classifyValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === "") return "empty";
  const lower = trimmed.toLowerCase();
  if (lower === "true" || lower === "false") return "boolean";
  if (NUMBER_RE.test(trimmed) && Number.isFinite(Number(trimmed))) return "number";
  if (ISO_DATE_RE.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return "date";
  return "string";
}

function summarizeCsv(text, options = {}) {
  const delimiter = options.delimiter || ",";
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0) {
    return { rowCount: 0, columnCount: 0, columns: [] };
  }
  const headers = rows[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  const dataRows = rows.slice(1);
  const columnCount = headers.length;

  const columns = headers.map((name, colIdx) => {
    let emptyCount = 0;
    const distinct = new Set();
    const types = new Set();
    const numbers = [];

    for (const r of dataRows) {
      const cell = colIdx < r.length ? r[colIdx] : "";
      const kind = classifyValue(cell);
      if (kind === "empty") {
        emptyCount++;
        continue;
      }
      const trimmed = cell.trim();
      distinct.add(trimmed);
      types.add(kind);
      if (kind === "number") {
        numbers.push(Number(trimmed));
      }
    }

    let inferredType = "empty";
    if (types.size === 1) {
      inferredType = [...types][0];
    } else if (types.size > 1) {
      inferredType = "string";
    }

    const colSummary = {
      name,
      type: inferredType,
      rowCount: dataRows.length,
      emptyCount,
      uniqueCount: distinct.size,
      min: null,
      max: null,
      sum: null,
      mean: null,
    };

    if (inferredType === "number" && numbers.length > 0) {
      let min = numbers[0];
      let max = numbers[0];
      let sum = 0;
      for (const n of numbers) {
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }
      colSummary.min = min;
      colSummary.max = max;
      colSummary.sum = Number(sum.toFixed(10));
      colSummary.mean = Number((sum / numbers.length).toFixed(10));
    }

    return colSummary;
  });

  return {
    rowCount: dataRows.length,
    columnCount,
    columns,
  };
}

function formatMarkdownTable(summary) {
  const lines = [
    "| Column | Type | Rows | Empty | Unique | Min | Max | Mean |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of summary.columns) {
    lines.push(
      `| ${c.name} | ${c.type} | ${c.rowCount} | ${c.emptyCount} | ${c.uniqueCount} | ${c.min ?? "—"} | ${c.max ?? "—"} | ${c.mean ?? "—"} |`,
    );
  }
  return lines.join("\n");
}

module.exports = {
  parseCsv,
  classifyValue,
  summarizeCsv,
  formatMarkdownTable,
};
