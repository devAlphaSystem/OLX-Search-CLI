# olx-search-cli

Command line and library tool to extract structured search results from OLX Brazil.

## Highlights

- Node.js CLI command: `olx-search`
- Programmatic API: `search`, `searchRaw`, `getCategories`
- Output formats: `json`, `table`, `jsonl`, `csv`
- Filters for state, category, sorting, strict matching
- Multi-state search with merge + dedupe strategy

## Requirements

- Node.js `>=18`
- Network access to `www.olx.com.br`

## Installation

This package is intended for local use and is not published to npm.

### Link CLI globally from local source

```bash
npm install
npm link
```

Use:

```bash
olx-search --help
```

### Link package into another local project

```bash
npm link olx-search-cli
```

### Unlink when needed

```bash
npm unlink -g olx-search-cli
```

## Quick Start

```bash
olx-search "iphone 15"
olx-search "notebook dell" -l 5 -f table
olx-search "bicicleta" --state sp --sort price_asc
olx-search "notebook" --category informatica/notebooks
olx-search --list-categories
```

## CLI Usage

```text
olx-search <query> [options]
```

### Arguments

| Argument | Required | Description |
|---|---|---|
| `query` | Yes | Search terms. |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `-l, --limit <n>` | integer | `20` | Maximum number of results returned. |
| `--sort <order>` | string | `relevance` | Sort order: `price_asc`, `price_desc`, `date`, `relevance`. |
| `--state <uf[,uf...]>` | string | none | One or more Brazilian UFs, ex: `sp` or `rj,mg,sp`. |
| `--category <slug>` | string | none | Category slug/path, ex: `celulares`, `informatica/notebooks`. |
| `--list-categories` | flag | `false` | Print all known OLX category slugs and exit. |
| `--timeout <ms>` | integer | `15000` | HTTP timeout per request. |
| `--concurrency <n>` | integer | `5` | Parallel detail-page requests. |
| `--strict` | flag | `false` | Keep only items matching all query tokens in title/description/properties. |
| `--no-rate-limit` | flag | `false` | Disable built-in rate limiting (may get your IP blocked). |
| `-f, --format <type>` | string | `json` | `json`, `table`, `jsonl`, `csv`. |
| `--pretty` | flag | `false` | Pretty print JSON output. |
| `--raw` | flag | `false` | Return raw `pageProps` object and exit. |
| `--fields <list>` | csv string | none | Keep selected fields only. |
| `-w, --web` | flag | `false` | Render HTML results and open browser. |
| `--log` | flag | `false` | Write a timestamped `.log` file to the project root with HTTP, search, and detail-enrichment traces. |
| `-h, --help` | flag | `false` | Show help. |
| `-v, --version` | flag | `false` | Show package version. |

## Rate Limiting

Built-in rate limiting is **enabled by default** to prevent your IP from being blocked by OLX.

- **Page delay:** 200 ms between pagination requests
- **Detail delay:** 100 ms between detail-enrichment batches
- **Max concurrency:** 3 parallel detail requests (overrides `--concurrency` when lower)

To disable rate limiting (at your own risk):

```bash
olx-search "notebook" --no-rate-limit
```

## Logging

Pass `--log` to write a timestamped log file (`olx-search_YYYY-MM-DD_HH-MM-SS.log`) to the project root.
The file records every HTTP request/response (URL, status code, content-type, body size), the constructed search URL, per-page parse counts, pagination progress, per-item detail-enrichment results, and the final summary.
No file is created when `--log` is omitted.

```bash
olx-search "iphone 15" --log
```

## Output Formats

- `json`: full structured response object
- `table`: colorized card-like terminal output
- `jsonl`: one JSON item per line
- `csv`: header + escaped row values

## Common Examples

```bash
# Basic
olx-search "iphone 15"

# Price ascending in Sao Paulo state
olx-search "notebook" --state sp --sort price_asc -f table

# Multiple states
olx-search "bicicleta" --state sp,rj,mg --sort relevance

# Category filtering
olx-search "celular" --category celulares --sort date

# Strict token filtering
olx-search "samsung s20" --strict -l 15 --pretty

# CSV export
olx-search "tv samsung" --fields title,price,permalink --format csv > olx-results.csv

# Raw extraction payload
olx-search "webcam" --raw > raw-olx-pageprops.json
```

## Library Usage

```js
import { search, searchRaw, getCategories } from "olx-search-cli";

const result = await search("notebook dell", {
  limit: 20,
  sort: "price_asc",
  state: "sp,rj",
  category: "informatica/notebooks",
  timeout: 15000,
  concurrency: 5,
  strict: false,
});

console.log(result.pagination);

const raw = await searchRaw("notebook", {
  state: "sp",
  category: "informatica",
});

console.log(raw.totalOfAds);
console.log(getCategories().slice(0, 5));
```

### API Reference

#### `search(query, options?)`

Returns:

- `items: object[]`
- `query: { text, sort, state, states, category, strict, url }`
- `pagination: { total, page, pageSize, limit, maxPages, resultsLimit, capped }`

Main options:

- `limit?: number`
- `timeout?: number`
- `sort?: "price_asc" | "price_desc" | "date" | "relevance"`
- `concurrency?: number`
- `state?: string` (single or comma-separated UFs)
- `category?: string` (must exist in known slug map)
- `strict?: boolean`
- `noRateLimit?: boolean`

#### `searchRaw(query, options?)`

Returns raw extracted `pageProps` object from OLX page data.

#### `getCategories()`

Returns array of `{ slug, name }`.

## Item Schema (normalized)

Each item can include:

- `id`
- `title`
- `price`
- `currency`
- `oldPrice`
- `discountPercent`
- `location`
- `locationDetails` (`municipality`, `uf`, `neighbourhood`)
- `date` (ISO)
- `dateTimestamp`
- `professionalAd`
- `thumbnail`
- `images`
- `imageCount`
- `videoCount`
- `permalink`
- `category`
- `categoryId`
- `properties`
- `olxPay`
- `olxDelivery`
- `isFeatured`
- `priceReduction`
- `description`
- `attributes`
- `sellerName`

Notes:

- `description`, `attributes`, and `sellerName` are enriched from ad detail pages.
- Many fields can be `null` when OLX does not expose them in page data.

## Validation and Errors

The CLI validates:

- positive integer `--limit`, `--timeout`, `--concurrency`
- allowed output formats
- valid Brazilian UFs in `--state`
- known category slug in `--category`

Typical failures:

- extraction errors if frontend payload changes
- network/rate limit/timeout issues
- fewer returned records than requested due platform page limits

## Performance Notes

- Multi-state mode triggers one search per UF and interleaves results.
- Max browse depth is internally capped (`maxPages`) to avoid excessive crawling.
- High concurrency speeds up enrichment but may increase request failures.

## Development

```bash
npm install
npm run format
```

## License

MIT
