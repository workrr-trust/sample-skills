---
name: csv-summary
description: Summarize a CSV file into deterministic column statistics (type, row count, empty cells, unique values, and numeric min/max/sum/mean). Use when the user asks for a quick overview or profile of tabular CSV data.
license: Apache-2.0
allowed-tools: Read
---

# CSV summary

## Overview

Computes a deterministic column-by-column summary of RFC 4180 CSV data (`summarize.cjs`) without modifying the input file.

## Steps

1. Read the CSV file the user names using `Read` (or run `node summarize.cjs <file.csv>`).
2. Parse RFC 4180 records, preserving quoted fields, escaped quotes (`""`), embedded commas, and CRLF/LF newlines.
3. For each column, classify its inferred type (`number`, `boolean`, `date`, `string`, or `empty`), count empty cells and distinct non-empty values, and compute `min`, `max`, `sum`, and `mean` for numeric columns.
4. Present the summary as a Markdown table with one row per column.
