---
name: pdf-extract
description: Extract structured text, metadata, page ranges, and aligned tables from PDF content streams. Use when the user asks to read, summarize, or extract tables from a PDF document.
license: Apache-2.0
allowed-tools: Read
---

# PDF extract

## Overview

Extracts text blocks, document metadata, and tabular rows from uncompressed PDF content streams (`extract.cjs`) deterministically without external native binaries.

## Steps

1. Read the target PDF file using `Read` (or run `node extract.cjs <file.pdf>`).
2. Parse the PDF header (`%PDF-1.x`), Info dictionary metadata (`Title`, `Author`, `CreationDate`), and page content streams (`BT ... ET`).
3. Decode literal strings (`(...)` with octal and backslash escapes), hex strings (`<...>`), and `TJ` kerning arrays, grouping positioned runs by baseline `y` coordinate.
4. Present extracted text per page and format multi-column rows as a Markdown table.
