---
name: create-orders-manager
description: >-
  Build a single-page Orders Manager application powered by the DataDoe REST API.
  Use when the user asks to create, scaffold, or build an orders manager, orders
  dashboard, orders table, or order management app using DataDoe.
metadata:
  author: DataDoe
  check-more-skills-at: https://app.datadoe.com/hub/ai-agents-and-skills
---

# DataDoe Orders Manager

Build a complete, working single-page Orders Manager app using the DataDoe REST API. The app must be functional after a single execution.

API docs: https://api.datadoe.com/api/v1/docs
Data scheme: https://api.datadoe.com/api/v1/spec/data-scheme

## Agent Type Detection

Determine your agent type before starting:

- **Low-level agent** (Cursor, Claude Code, Codex, Aider, etc.): follow the **Default Tech Stack** below.
- **High-level vibe coding assistant** (Lovable, Base44, Bolt, v0, etc.): ignore the tech stack section entirely; use whatever the platform provides. Follow only the **App Features**, **DataDoe API Integration**, and **Implementation Rules** sections.

## App Features

### 1. Seller/Vendor Picker

- On load, fetch connected sellers and vendors from the API.
- Show a dropdown to select one. Orders cannot be loaded without a selection.
- Only sellers with `sellerCentralConnection !== null` are valid (Order Line Items source is `SELLER_CENTRAL`).

### 2. Orders Table

- Display orders in a table with expandable nested rows for line items.
- Parent row: `amazon_order_id`, `order_date`, `order_status`, `fulfillment_channel`, total item count, total price.
- Child rows (expanded): `sku`, `child_asin`, `product_name`, `quantity`, `item_price_value`, `item_price_currency`, `item_status`.
- Client-side pagination with configurable page size (10/25/50).

### 3. Filters

- **Date range**: date-from / date-to inputs. Default: last 30 days.
- **Order status**: multi-select checkboxes. Values: `Pending`, `Unshipped`, `PartiallyShipped`, `Shipped`, `Canceled`, `Unfulfillable`, `InvoiceUnconfirmed`, `PendingAvailability`.
- Applying filters triggers a new export.

### 4. Order Tagging (Local)

- Tags are NOT part of the DataDoe API — they are stored in `localStorage`.
- Each order (`amazon_order_id`) can have zero or more text tags.
- UI: inline tag chips with "add tag" button + text input.
- Prefix all localStorage keys with `datadoe-orders-manager::` for collision safety.
- Enforce via TypeScript branded type:

```typescript
type StorageKey = `datadoe-orders-manager::${string}`;
```

### 5. Loading & Error States

- Show a spinner/skeleton during export creation and polling.
- Show user-friendly error messages for API failures (network errors, 429 rate limits, 4xx/5xx).
- On 429: auto-retry after `Retry-After` header value.

## DataDoe API Integration

### Auth & Config

The app always targets the **production** DataDoe API at `https://api.datadoe.com`. During local development, Vite proxies `/api` requests to this domain to avoid CORS. There is no staging/production distinction — always use the same API target.

`.env` file structure (create `.env.example` with the placeholders below):

```bash
# Vite proxies /api → https://api.datadoe.com (CORS bypass for local dev)
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=https://api.datadoe.com
VITE_DATADOE_API_KEY=<your-api-key>
```

- `VITE_API_BASE_URL` **must always be `/api`** — the browser app never calls `api.datadoe.com` directly.
- `VITE_PROXY_TARGET` **must always be `https://api.datadoe.com`** — this is the Vite proxy upstream.
- `VITE_DATADOE_API_KEY` — the API key obtained from the DataDoe dashboard.

**Header selection logic** (mutually exclusive — never send both):

- If `VITE_DATADOE_API_KEY` is set → attach `datadoe-api-key` header.
- Else if `VITE_DATADOE_ORGANIZATION_ID` is set → attach `datadoe-organization-id` header.

Always attach `Content-Type: application/json` and `Accept: application/json`.

Rate limit: 2 req/s per org. On `429`, read `Retry-After` header, wait, retry.

### Anti-Rate-Limit Guardrails (Mandatory)

1. **Global client-side pacing**: cap all DataDoe requests to **max 1 request every 600ms** (<= ~1.67 req/s), leaving headroom under 2 req/s.
2. **Single in-flight flow per seller**: never run multiple export flows in parallel for the same seller.
3. **No parallel polling**: only one active poll loop per export; cancel/replace stale loops before starting new ones.
4. **Debounce filter-triggered exports**: wait **400-800ms** after filter changes before creating a new export.
5. **Serialize bursty steps**: when chaining create → poll → raw download, avoid extra background fetches in parallel.
6. **Respect `Retry-After` exactly** on `429`, then add incremental delay for subsequent retries.

If these constraints conflict with UI responsiveness, prioritize staying below rate limits.

### Export Flow (5 steps)

**1. Fetch sellers**

```
GET /api/v1/util/sellers-and-vendors
→ { items: [{ id, name, sellerCentralConnection, vendorCentralConnection, amazonAdsConnection }] }
```

Filter to items where `sellerCentralConnection` is not null.

**2. Fetch export sources (get source ID)**

```
GET /api/v1/exports/sources?sellerOrVendorIds=<sellerId>
```

Find the source named `Order Line Items` (type `SELLER_CENTRAL`).
Hardcode fallback ID: `89b27535d27c2a94db5ae39af4717f542624ff4df7802fd633e16c78674a1778`

**3. Create export**

```
POST /api/v1/exports
```

Request body:

```json
{
  "sellerOrVendorIds": ["<sellerId>"],
  "sourceId": "89b27535d27c2a94db5ae39af4717f542624ff4df7802fd633e16c78674a1778",
  "columns": [
    "amazon_order_id",
    "order_date",
    "order_status",
    "fulfillment_channel",
    "sku",
    "line_item_number",
    "child_asin",
    "product_name",
    "item_status",
    "quantity",
    "item_price_value",
    "item_price_currency"
  ],
  "from": "2025-01-01T00:00:00.000Z",
  "to": "2025-01-31T23:59:59.999Z",
  "outputType": "JSON",
  "sendToAllOrganizationMembers": false
}
```

To filter by status, add `filters`:

```json
{
  "filters": {
    "combinator": "or",
    "rules": [
      {
        "field": "order_status",
        "operator": "=",
        "value": "Shipped",
        "not": false
      },
      {
        "field": "order_status",
        "operator": "=",
        "value": "Pending",
        "not": false
      }
    ]
  }
}
```

Response: `{ id, status: "PENDING", ... }`.

**4. Poll status** (every 5s, timeout 2min)

```
GET /api/v1/exports/<exportId>
→ { status: "PENDING" | "PROCESSING" | "COMPLETED" | "ERROR" }
```

**5. Download data**

When `status` is `COMPLETED`, download. If `ERROR`, show error.

```
GET /api/v1/exports/<exportId>/raw
```

- `200`: redirects (302) to a pre-signed S3 URL — axios must follow the redirect automatically (`followRedirects: true` in Vite proxy handles this on the server side; the browser axios instance follows it natively).
- `204`: still processing — retry after a few seconds.
- `404`: export not found.

Example row returned in the flat array:

```json
{
  "seller_id": "54fa3cs2-b69f-4642-82c4-58fe731eed69",
  "seller_name": "DataDoe UK",
  "marketplace_name": "United Kingdom",
  "amazon_order_id": "203-5492174-4518714",
  "sku": "341_SDA12D_117_FBA",
  "line_item_number": 0,
  "order_date": null,
  "order_status": "Shipped",
  "fulfillment_channel": "Amazon",
  "child_asin": "ABCDEFGHIJ",
  "product_name": "xyz",
  "item_status": "Shipped",
  "quantity": 2,
  "item_price_value": 14.76,
  "item_price_currency": "GBP"
}
```

For the full column reference, see: https://api.datadoe.com/api/v1/spec/data-scheme

### Raw Data Shape & Client-Side Grouping Logic

The `/raw` endpoint returns a **flat array of line items**. Each element represents one SKU within one order. An order with N distinct SKUs produces N rows all sharing the same `amazon_order_id`.

**CRITICAL — `columns: []` (empty array) does NOT return all columns.** It returns only implicit seller-context metadata columns (`seller_id`, `seller_name`, `amazon_selling_partner_id`, `marketplace_name`, etc.) and none of the Order Line Items fields (`amazon_order_id`, `sku`, `order_status`, etc.). Always specify the required columns explicitly.

**Field roles:**

| Field                 | Level     | Notes                                                             |
| --------------------- | --------- | ----------------------------------------------------------------- |
| `amazon_order_id`     | Order     | Grouping key — unique per order                                   |
| `order_status`        | Order     | Consistent across all rows for the same order                     |
| `fulfillment_channel` | Order     | Consistent across all rows for the same order                     |
| `order_date`          | Order     | **Always `null` in practice** — do not use for display or sorting |
| `sku`                 | Line item | Unique product identifier within the order                        |
| `line_item_number`    | Line item | 0-based index of the line item within the order                   |
| `child_asin`          | Line item | Amazon ASIN                                                       |
| `product_name`        | Line item | Full product name                                                 |
| `item_status`         | Line item | Can differ from `order_status`                                    |
| `quantity`            | Line item | Units for this SKU only                                           |
| `item_price_value`    | Line item | Unit price (multiply by `quantity` for line total)                |
| `item_price_currency` | Line item | Consistent across all rows for the same order                     |

**How to build the parent (order) row from the flat array:**

```typescript
// Group by amazon_order_id — preserve API row order (order_date is always null)
const ordersMap = new Map<string, OrderRow>();

for (const item of lineItems) {
  const existing = ordersMap.get(item.amazon_order_id);
  if (existing) {
    existing.lineItems.push(item);
    existing.totalPrice += item.item_price_value * item.quantity;
    existing.itemCount += item.quantity;
  } else {
    ordersMap.set(item.amazon_order_id, {
      amazon_order_id: item.amazon_order_id,
      order_status: item.order_status, // order-level, consistent
      fulfillment_channel: item.fulfillment_channel, // order-level, consistent
      order_date: item.order_date, // null — show "—" or omit
      currency: item.item_price_currency, // consistent per order
      totalPrice: item.item_price_value * item.quantity,
      itemCount: item.quantity,
      lineItems: [item],
    });
  }
}

const orders = Array.from(ordersMap.values());
// Do NOT sort by order_date — it is always null.
// Preserve insertion order (API natural order) or sort by amazon_order_id alphabetically.
```

**Parent row columns to display:**

| Column     | Source                                | Display                |
| ---------- | ------------------------------------- | ---------------------- |
| Order ID   | `amazon_order_id`                     | Monospace, full string |
| Order Date | `order_date`                          | Always null → show `—` |
| Status     | `order_status` (first item)           | Coloured badge         |
| Channel    | `fulfillment_channel` (first item)    | Badge                  |
| Items      | `sum(quantity)` across all line items | Number                 |
| Total      | `sum(item_price_value × quantity)`    | Formatted currency     |
| Tags       | localStorage only                     | Tag chips              |

**Child (line item) row columns to display:**

| Column      | Source                                     |
| ----------- | ------------------------------------------ |
| SKU         | `sku`                                      |
| ASIN        | `child_asin`                               |
| Product     | `product_name`                             |
| Qty         | `quantity`                                 |
| Price       | `item_price_value` + `item_price_currency` |
| Item Status | `item_status`                              |

**CRITICAL — API parameter formats discovered through testing:**

- `GET /exports/sources` uses **bare** query param `sellerOrVendorIds=<uuid>` — **not** `sellerOrVendorIds[]=<uuid>` and **not** `sellerOrVendorIds[0]=<uuid>`. The bracket syntax is rejected with 400.
- `POST /exports` **`columns` must be an explicit list** of the field names you need — never pass `[]` (empty). An empty array returns only seller-context metadata with no order fields, causing the table to display empty rows.
- Date range uses **top-level** `from` and `to` fields (ISO 8601 datetime strings like `2025-01-01T00:00:00.000Z`) — **not** inside `filters`.
- `filters` uses `combinator` with **lowercase** values: `"and"` or `"or"` (not `"AND"` / `"OR"`).
- Each filter rule **must** include the `not` field (boolean): `{ "field": "...", "operator": "...", "value": "...", "not": false }`.
- If no filter rules are needed, either omit `filters` entirely or pass `{ "combinator": "and", "rules": [] }`.

## Default Tech Stack (Low-Level Agents Only)

Skip this section if you are a high-level assistant.

| Tool           | Version / Notes                                                |
| -------------- | -------------------------------------------------------------- |
| Vite           | Latest, React + TypeScript template (`npm create vite@latest`) |
| React          | 18+ with TypeScript strict mode                                |
| axios          | **1.13.6 only** (security requirement)                         |
| TanStack Table | `@tanstack/react-table` latest                                 |
| day.js         | Latest, for date formatting and manipulation                   |
| Lucide React   | Latest, for icons                                              |
| CSS Modules    | Native CSS, no Tailwind or component libraries                 |
| Google Sans    | Font via Google Fonts CDN                                      |

### Setup

Vite creates a nested directory. Move all files up to the workspace root so the project lives at the top level:

```bash
npm create vite@latest orders-manager -- --template react-ts
shopt -s dotglob && mv orders-manager/* . && rmdir orders-manager
npm install axios@1.13.6 @tanstack/react-table dayjs lucide-react
```

### Required Execution Order

1. Scaffold Vite app in `orders-manager`.
2. Move generated files/folders to workspace root.
3. Install dependencies.
4. Add `.env` to `.gitignore`.
5. Create `.env.example`.
6. Verify API connectivity with curl.
7. Implement app code using exact snippets from the **Mandatory Code Snippets** section.
8. Run build/lint checks.

### File Structure (Feature-Based)

Every component lives in its own directory containing exactly two files: the component file and its CSS Module. No component files sit loose in a parent folder.

```
src/
├── main.tsx
├── App.tsx
├── App.module.css
├── shared/
│   ├── styles/
│   │   ├── global.css          # imports tokens, typography, palette
│   │   ├── tokens.css          # CSS custom properties: colors, spacing
│   │   ├── typography.css      # font families, sizes, weights
│   │   ├── colors.css          # color palette utility classes
│   │   └── spacing.css         # margin/padding utility classes
│   ├── components/
│   │   ├── DataTable/
│   │   │   ├── DataTable.tsx        # generic TanStack Table wrapper
│   │   │   └── DataTable.module.css
│   │   ├── Spinner/
│   │   │   ├── Spinner.tsx
│   │   │   └── Spinner.module.css
│   │   └── ErrorMessage/
│   │       ├── ErrorMessage.tsx
│   │       └── ErrorMessage.module.css
│   ├── hooks/
│   │   └── useLocalStorage.ts
│   ├── utils/
│   │   └── localStorage.ts  # branded StorageKey type, get/set helpers
│   └── api/
│       └── client.ts        # axios instance + 429 retry interceptor
├── features/
│   └── orders/
│       ├── OrdersManager/
│       │   ├── OrdersManager.tsx
│       │   └── OrdersManager.module.css
│       ├── OrdersTable/
│       │   ├── OrdersTable.tsx
│       │   └── OrdersTable.module.css
│       ├── OrderFilters/
│       │   ├── OrderFilters.tsx
│       │   └── OrderFilters.module.css
│       ├── OrderTags/
│       │   ├── OrderTags.tsx
│       │   └── OrderTags.module.css
│       ├── SellerPicker/
│       │   ├── SellerPicker.tsx
│       │   └── SellerPicker.module.css
│       ├── hooks/
│       │   ├── useOrders.ts
│       │   ├── useExport.ts
│       │   └── useSellers.ts
│       ├── types.ts
│       └── utils.ts
```

### Styling Rules

- Define design tokens as CSS custom properties in `tokens.css`.
- Import Google Sans in `global.css`: `@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');`
- Each component gets its own `.module.css` file.
- No inline styles. No Tailwind. No component libraries.

### Generic DataTable Component

Create a generic `DataTable<T>` component that:

- Accepts `columns: ColumnDef<T>[]`, `data: T[]`, and optional `renderSubComponent`.
- Handles pagination (page size selector: 10/25/50).
- Uses `getExpandedRowModel()` for nested row expansion.
- Renders via CSS Modules — the orders feature passes its own column definitions.

### localStorage Key Safety

```typescript
type StorageKey = `datadoe-orders-manager::${string}`;

function getItem(key: StorageKey): string | null {
  return localStorage.getItem(key);
}

function setItem(key: StorageKey, value: string): void {
  localStorage.setItem(key, value);
}
```

## Mandatory API Connectivity Check (before UI)

**Never edit `.env` automatically — treat it as a protected secrets file.**

### Step 1: Direct Target Connectivity

```bash
source .env
curl -sS -o /tmp/datadoe-sellers.json -D /tmp/datadoe-sellers.headers \
  "$VITE_PROXY_TARGET/api/v1/util/sellers-and-vendors" \
  -H "datadoe-api-key: $VITE_DATADOE_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json"
cat /tmp/datadoe-sellers.headers | head -1
```

Expected: `HTTP/2 200`. **Continue only when direct check returns HTTP 200.**
If 403: wrong API key for the target. If 502: DNS/network issue. **Stop and fix before coding.**

### Step 2: Local Proxy Verification (after `npm run dev`)

After starting the dev server, read its output to find the actual port (may not be 5173 if that port is in use), then run:

```bash
source .env
DEV_PORT=<actual-port-from-vite-output>
curl -sS -o /tmp/datadoe-proxy-sellers.json -D /tmp/datadoe-proxy-sellers.headers \
  "http://localhost:${DEV_PORT}/api/v1/util/sellers-and-vendors" \
  -H "datadoe-api-key: $VITE_DATADOE_API_KEY" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json"
cat /tmp/datadoe-proxy-sellers.headers | head -1
```

Expected: `HTTP/1.1 200 OK`. **Finish only when localhost proxy check also returns HTTP 200.**

### Debug Path for 403/502

If either check fails, follow this mandatory debug strategy:

- `502` + `ENOTFOUND`: proxy target DNS/network mismatch. Verify `VITE_PROXY_TARGET` is exactly `https://api.datadoe.com` and that the process has network access. If running in a sandbox, restart with full network permissions.
- `502` on wrong localhost port: check actual Vite port from terminal output and retry on the correct port.
- `403`: API key/target environment mismatch (e.g., staging key used against production target). Verify the API key matches the target.
- After **any** fix, re-run **both** checks (direct target and localhost proxy).

## Mandatory Code Snippets

The following files must be implemented **exactly as shown**. These are verified working against the production API. Do not modify the proxy configuration, base URL logic, header logic, or request parameter shapes.

### `vite.config.ts` — Proxy Configuration

```typescript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "https://api.datadoe.com";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          followRedirects: true,
        },
      },
    },
  };
});
```

**Why this works:** The browser sends requests to `/api/v1/...` on localhost. Vite's dev server proxies them to `https://api.datadoe.com/api/v1/...`. `changeOrigin: true` sets the `Host` header to the target. `secure: true` enforces TLS verification. `followRedirects: true` handles any 3xx from the API.

### `src/api/client.ts` — Axios Instance with Pacing & 429 Retry

```typescript
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API_KEY = import.meta.env.VITE_DATADOE_API_KEY;
const ORG_ID = import.meta.env.VITE_DATADOE_ORGANIZATION_ID;

const MIN_REQUEST_INTERVAL_MS = 600;
let lastRequestTime = 0;

async function waitForPacing(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

function buildAuthHeaders(): Record<string, string> {
  if (API_KEY) {
    return { "datadoe-api-key": API_KEY };
  }
  if (ORG_ID) {
    return { "datadoe-organization-id": ORG_ID };
  }
  return {};
}

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...buildAuthHeaders(),
  },
});

instance.interceptors.request.use(async (config) => {
  await waitForPacing();
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const response = error.response as AxiosResponse | undefined;
    if (response?.status === 429) {
      const retryAfter = parseInt(response.headers["retry-after"] || "1", 10);
      const delay = retryAfter * 1000 + 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return instance.request(error.config as AxiosRequestConfig);
    }
    return Promise.reject(error);
  }
);

export default instance;
```

**Critical details:**

- `BASE_URL` is always `/api` (from `.env`), never a full URL — all requests go through the Vite proxy.
- Auth headers use `datadoe-api-key` (not `datadoe-organization-id`) when both are available. Never send both.
- The pacing interceptor enforces 600ms minimum between requests (< 2 req/s limit).
- The 429 interceptor reads `Retry-After`, waits, and retries once.

### `src/api/datadoe.ts` — API Functions with Correct Request Shapes

```typescript
import client from "./client";

const ORDER_LINE_ITEMS_SOURCE_ID =
  "89b27535d27c2a94db5ae39af4717f542624ff4df7802fd633e16c78674a1778";

export async function fetchSellersAndVendors() {
  const response = await client.get<{ items: any[] }>(
    "/v1/util/sellers-and-vendors"
  );
  return response.data.items;
}

// IMPORTANT: query param is sellerOrVendorIds=<uuid> (no brackets)
export async function fetchOrderLineItemsSourceId(
  sellerId: string
): Promise<string> {
  try {
    const response = await client.get<any[]>(
      `/v1/exports/sources?sellerOrVendorIds=${sellerId}`
    );
    const orderSource = response.data.find(
      (s: any) => s.name === "Order Line Items" && s.type === "SELLER_CENTRAL"
    );
    return orderSource?.id ?? ORDER_LINE_ITEMS_SOURCE_ID;
  } catch {
    return ORDER_LINE_ITEMS_SOURCE_ID;
  }
}

// Required columns for the Order Line Items source.
// NEVER pass columns: [] — an empty array returns only seller-context metadata
// (seller_id, seller_name, marketplace_name, etc.) with NO order fields,
// which causes the table to display empty rows.
const ORDER_LINE_ITEMS_COLUMNS = [
  "amazon_order_id",
  "order_date",
  "order_status",
  "fulfillment_channel",
  "sku",
  "line_item_number",
  "child_asin",
  "product_name",
  "item_status",
  "quantity",
  "item_price_value",
  "item_price_currency",
];

// IMPORTANT: export creation request shape — all fields are mandatory.
// - from/to are TOP-LEVEL ISO datetime strings (not inside filters).
// - columns must be an EXPLICIT list of field names (never empty []).
// - sendToAllOrganizationMembers is required (use false).
// - filters.combinator is lowercase: "and" or "or".
// - each filter rule must have a "not" boolean field.
export async function createExport(
  sellerId: string,
  sourceId: string,
  dateFrom: string,
  dateTo: string,
  orderStatusFilters: string[] = []
) {
  const body: Record<string, unknown> = {
    sourceId,
    sellerOrVendorIds: [sellerId],
    outputType: "JSON",
    columns: ORDER_LINE_ITEMS_COLUMNS,
    sendToAllOrganizationMembers: false,
    from: `${dateFrom}T00:00:00.000Z`,
    to: `${dateTo}T23:59:59.999Z`,
  };

  if (orderStatusFilters.length > 0) {
    body.filters = {
      combinator: "or",
      rules: orderStatusFilters.map((status) => ({
        field: "order_status",
        operator: "=",
        value: status,
        not: false,
      })),
    };
  }

  const response = await client.post<any>("/v1/exports", body);
  return response.data;
}

export async function pollExport(exportId: string) {
  const response = await client.get<any>(`/v1/exports/${exportId}`);
  return response.data;
}

export async function fetchExportRaw(exportId: string) {
  const response = await client.get(`/v1/exports/${exportId}/raw`, {
    validateStatus: (status) => status === 200 || status === 204,
  });
  if (response.status === 204) return null;
  return response.data;
}
```

### `.env.example`

```bash
# Vite proxies /api → https://api.datadoe.com (CORS bypass for local dev)
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=https://api.datadoe.com
VITE_DATADOE_API_KEY=<your-api-key>
```

## Implementation Rules

1. **Single run**: the app must work after one execution. Do not leave TODOs or placeholders.
2. **Test API calls first**: before coding the full UI, verify the export flow works by running the mandatory connectivity checks.
3. **Group line items by order**: the API returns flat rows. Group by `amazon_order_id` before rendering.
4. **Handle empty states**: no sellers, no orders, export still loading — all need UI.
5. **Date defaults**: from = 30 days ago, to = today.
6. **Use `outputType: "JSON"`** for exports.
7. **Poll interval**: 5 seconds between status checks. Timeout after 2 minutes with an error message.
8. **Retry on 429**: auto-retry with the `Retry-After` value, with incrementally increasing delays.
9. **Use the exact code snippets** from the Mandatory Code Snippets section for `vite.config.ts`, `src/api/client.ts`, and `src/api/datadoe.ts`.
10. **Run build and lint** before finalizing.
11. **Leave dev server running** in background after implementation.
12. **Report local URL, proxy check result**, and any residual risk explicitly.

## Protected Files

**Never modify `.env`.**

- Use `.env.example` as reference and documentation target.
- Never print `.env` secrets in output.

## Post-Implementation Startup

Always run dev server in background:

```bash
npm run dev
```

## Verification Checklist

After implementation, verify:

- App starts without errors (`npm run dev`).
- Seller picker loads and shows sellers.
- Selecting a seller and clicking "Load Orders" triggers the export flow.
- Orders appear in the table grouped by `amazon_order_id`.
- Expanding a row shows line items.
- Date filter changes trigger new exports.
- Status filter with checkboxes works.
- Tags can be added, removed, and persist across page reloads.
- Loading spinner shows during export polling.
- Error messages display on API failure.
- Pagination controls work (10/25/50 per page).
