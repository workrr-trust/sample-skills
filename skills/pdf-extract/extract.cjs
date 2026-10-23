"use strict";

// Deterministic PDF content stream, metadata, and table extractor for pdf-extract.

function decodePdfLiteralString(inner) {
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = inner[++i];
    if (next === undefined) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "(" || next === ")" || next === "\\") out += next;
    else if (next >= "0" && next <= "7") {
      let oct = next;
      if (inner[i + 1] >= "0" && inner[i + 1] <= "7") oct += inner[++i];
      if (inner[i + 1] >= "0" && inner[i + 1] <= "7") oct += inner[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hex) {
  const clean = hex.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid hex string in PDF stream");
  }
  const padded = clean.length % 2 === 1 ? clean + "0" : clean;
  const bytes = [];
  for (let i = 0; i < padded.length; i += 2) {
    bytes.push(parseInt(padded.slice(i, i + 2), 16));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let u16 = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      u16 += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return u16;
  }
  return Buffer.from(bytes).toString("utf8");
}

function parsePageRange(spec, totalPages) {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new RangeError("totalPages must be a positive integer");
  }
  if (!spec || String(spec).trim() === "" || String(spec).trim() === "all") {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set();
  for (const part of String(spec).split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const rangeMatch = /^(\d+)-(\d+)$/.exec(trimmed);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < start || end > totalPages) {
        throw new RangeError(`Invalid page range: ${trimmed}`);
      }
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (/^\d+$/.test(trimmed)) {
      const p = Number(trimmed);
      if (p < 1 || p > totalPages) throw new RangeError(`Page out of bounds: ${p}`);
      pages.add(p);
    } else {
      throw new Error(`Malformed page range token: ${trimmed}`);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

function extractInfoMetadata(pdfText) {
  const info = {};
  const keys = ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate"];
  for (const key of keys) {
    const litRe = new RegExp(`/${key}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`);
    const hexRe = new RegExp(`/${key}\\s*<([0-9a-fA-F\\s]*)>`);
    const mLit = litRe.exec(pdfText);
    if (mLit) {
      info[key] = decodePdfLiteralString(mLit[1]);
      continue;
    }
    const mHex = hexRe.exec(pdfText);
    if (mHex) {
      info[key] = decodePdfHexString(mHex[1]);
    }
  }
  return info;
}

function extractTextRunsFromStream(streamText) {
  const runs = [];
  const blocks = streamText.match(/BT[\s\S]*?ET/g) || [];
  for (const block of blocks) {
    let x = 0;
    let y = 0;
    const lines = block.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const tdMatch = /^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+Td\b/.exec(line);
      if (tdMatch) {
        x += Number(tdMatch[1]);
        y += Number(tdMatch[2]);
      }
      const tmMatch =
        /^[+-]?\d+(?:\.\d+)?\s+[+-]?\d+(?:\.\d+)?\s+[+-]?\d+(?:\.\d+)?\s+[+-]?\d+(?:\.\d+)?\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+Tm\b/.exec(
          line,
        );
      if (tmMatch) {
        x = Number(tmMatch[1]);
        y = Number(tmMatch[2]);
      }
      const tjLit = /\(((?:\\.|[^\\)])*)\)\s*Tj\b/.exec(line);
      if (tjLit) {
        runs.push({ x, y, text: decodePdfLiteralString(tjLit[1]) });
      }
      const tjHex = /<([0-9a-fA-F\s]+)>\s*Tj\b/.exec(line);
      if (tjHex) {
        runs.push({ x, y, text: decodePdfHexString(tjHex[1]) });
      }
      const tjArr = /\[([\s\S]*?)\]\s*TJ\b/.exec(line);
      if (tjArr) {
        let combined = "";
        const tokenRe = /\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>|([+-]?\d+(?:\.\d+)?)/g;
        let tok;
        while ((tok = tokenRe.exec(tjArr[1])) !== null) {
          if (tok[1] !== undefined) combined += decodePdfLiteralString(tok[1]);
          else if (tok[2] !== undefined) combined += decodePdfHexString(tok[2]);
          else if (Number(tok[3]) <= -180) combined += " ";
        }
        if (combined) runs.push({ x, y, text: combined });
      }
    }
  }
  return runs;
}

function groupRunsIntoRows(runs, yTolerance = 2) {
  if (!Array.isArray(runs) || runs.length === 0) return [];
  const sorted = [...runs].sort((a, b) => (Math.abs(b.y - a.y) > yTolerance ? b.y - a.y : a.x - b.x));
  const groups = [];
  for (const r of sorted) {
    const last = groups[groups.length - 1];
    if (!last || Math.abs(last.y - r.y) > yTolerance) {
      groups.push({ y: r.y, items: [r] });
    } else {
      last.items.push(r);
    }
  }
  return groups.map((g) => g.items.sort((a, b) => a.x - b.x).map((i) => i.text));
}

function extractPdfDocument(pdfText, options = {}) {
  if (typeof pdfText !== "string" || !pdfText.startsWith("%PDF-")) {
    throw new Error("Invalid PDF header: expected %PDF-");
  }
  const versionMatch = /^%PDF-(\d+\.\d+)/.exec(pdfText);
  const version = versionMatch ? versionMatch[1] : "1.4";
  const metadata = extractInfoMetadata(pdfText);
  const streamMatches = [...pdfText.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  const allPages = streamMatches.map((m, idx) => {
    const runs = extractTextRunsFromStream(m[1]);
    const rows = groupRunsIntoRows(runs);
    const text = rows.map((r) => r.join(" ")).join("\n");
    return { pageNumber: idx + 1, runs, rows, text };
  });

  const totalPages = allPages.length || 1;
  const selectedNums = parsePageRange(options.pages, totalPages);
  const pages = allPages.filter((p) => selectedNums.includes(p.pageNumber));
  return {
    version,
    pageCount: allPages.length,
    metadata,
    pages,
  };
}

module.exports = {
  decodePdfLiteralString,
  decodePdfHexString,
  parsePageRange,
  extractInfoMetadata,
  extractTextRunsFromStream,
  groupRunsIntoRows,
  extractPdfDocument,
};
