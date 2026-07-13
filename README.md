# DataDoe AI Skills

[![skills.sh](https://skills.sh/b/deltologic/datadoe-ai-skills)](https://skills.sh/deltologic/datadoe-ai-skills)

Public library of reusable AI skills that help users go from **one prompt to a working MVP/PoC app** powered by the DataDoe API.

Each skill is a practical blueprint you can use in coding agents (for example Cursor, Codex, Claude Code, Aider) to scaffold a ready-to-run application flow.

Most skills run in any MCP client (Claude, ChatGPT, Cursor, Claude Code) against the DataDoe MCP server; a few scaffold full apps via the DataDoe REST API. The **Interface** column below tells you which each skill needs.

## Purpose

- Provide ready-made skill instructions for building DataDoe-powered apps quickly.
- Standardize how AI agents generate apps that integrate with the DataDoe API.
- Reduce time from idea to first working prototype.

## How To Use

1. Pick a skill from the `skills/` directory.
2. Open its `SKILL.md` file.
3. In your coding agent, ask it to build the app using that skill.
4. Follow the generated setup steps (environment variables, API key, run commands).
5. Run and iterate on the generated MVP/PoC.

### One-shot example prompt

```text
Build this app using @skills/create-orders-manager/SKILL.md.
Follow the skill exactly and generate a complete working implementation.
```

## Available Skills

**Access:** 🔍 **Read-only** - only reads your data, never changes anything on Amazon. ✍️ **Write (approval-gated)** - can change your account, but always previews with a dry run first and applies only on your explicit approval; you stay in full control.

**Interface:** 🔌 **MCP** - runs in any MCP client (Claude, ChatGPT, Cursor, Claude Code). 🧩 **API** - builds on the DataDoe REST API. 🔀 **Both** - MCP-first with a REST fallback.

**Output:** 📊 **Report** - analysis / an HTML card / a dashboard, delivered in your assistant. 🖥️ **App** - a runnable code project the skill scaffolds. ⚡ **Action** - an approval-gated change to your account.

| Skill | Access | Interface | Output | Category | What it builds | Best for |
| --- | --- | --- | --- | --- | --- | --- |
| `create-orders-manager` | 🔍 Read-only | 🧩 API | 🖥️ App | Reporting | A complete single-page Orders Manager app with seller/vendor picker, orders table with nested line items, filtering, local tagging, and robust DataDoe export/poll/download flow. | Teams that need a fast operational dashboard for order analysis and workflows. |
| `create-amazon-reconciliation-dashboard` | 🔍 Read-only | 🔀 Both | 📊 Report | Reporting | A self-contained interactive Amazon Reconciliation Dashboard with month switching, KPI cards, charts, a daily summary table, and an Order Explorer for reconciling Amazon orders against settlements. | Teams that need to compare Amazon orders and settlements across a 6-month window with clear cross-month reconciliation. |
| `weekly-sales-briefing` | 🔍 Read-only | 🔌 MCP | 📊 Report | Reporting | A polished interactive HTML weekly sales briefing card with KPI tiles, top 5 SKUs, biggest week-over-week drops, and concise AI-generated insights from DataDoe exports. | Sellers and operators who need a fast weekly performance recap with clear trend signals and SKU-level highlights. |
| `sales-movers-scanner` | 🔍 Read-only | 🔌 MCP | 📊 Report | Reporting | A catalog-wide scan of the biggest sales movers (up and down) that decomposes each move into its cause - traffic, conversion, price or buy-box - ranked by money, with a data-completeness guard so a lagging recent week isn't reported as a fake collapse, from DataDoe sales & traffic data. | Sellers who want a Monday-morning "what changed and why" list that's already diagnosed per SKU, not just a table of deltas. |
| `weekly-business-review` | 🔍 Read-only | 🔌 MCP | 📊 Report | Profit & Finance | An interactive weekly business-review card covering profit, margin, ad efficiency (TACoS) and inventory, comparing this week to a trailing 4-week baseline, with a cost-driver drill for any margin/fee anomaly and concrete next actions, from DataDoe data. | Sellers and operators who want a weekly profit and health review that explains what changed and why - not just sales. |
| `daily-account-health-check` | 🔍 Read-only | 🔌 MCP | 📊 Report | Account Health | A daily account-health check that scores AHR, order-defect rate, late-shipment, valid-tracking, cancellation and policy violations against Amazon's own targets, rolled up to a red/amber/green verdict with the exact issues to fix first, from DataDoe. | Sellers and operators who want a fast daily "is my account safe" smoke alarm that catches policy and performance risks before they escalate. |
| `ppc-wasted-spend-watchdog` | 🔍 Read-only | 🔌 MCP | 📊 Report | PPC & Ads | A Sponsored Products wasted-spend report that finds dead search terms (clicks, no orders) and bleeders (converting above your break-even ACoS), quantifies the money to reclaim, and routes them to the negative-keyword and bid-optimizer skills, from DataDoe. | Sellers and agencies who want a fast weekly PPC clean-up that pinpoints exactly which search terms to negate or cut bids on. |
| `net-profit-pl-analyzer` | 🔍 Read-only | 🔌 MCP | 📊 Report | Profit & Finance | A true net-profit-by-SKU report - after Amazon fees, FBA, COGS and ad spend, not just sales - ranking the real profit winners and surfacing SKUs that are quietly losing money, from DataDoe. | Sellers and operators who want to know which products actually make money and where margin is leaking, not just top-line revenue. |
| `return-refund-analyzer` | 🔍 Read-only | 🔌 MCP | 📊 Report | Profit & Finance | Finds the SKUs bleeding the most margin to returns and why they come back - the real reasons bucketed into product, listing, sizing and delivery - ranked by money lost (not return rate) and filtered to the actionable returns, from DataDoe returns, sales and COGS data. | Sellers who want to cut returns where it pays: a money-ranked, reason-diagnosed list that says whether to fix the product, the listing, or the sizing. |
| `restock-priority-alert` | 🔍 Read-only | 🔌 MCP | 📊 Report | Inventory | An FBA restock priority list that ranks SKUs about to stock out by urgency (days of supply vs velocity, inbound-aware) with how many units to ship and by when, from DataDoe's inventory health data. | Sellers who want a fast weekly restock plan that catches stockouts before they cost sales, without over-ordering. |
| `buy-box-loss-root-cause` | 🔍 Read-only | 🔌 MCP | 📊 Report | Listings & Content | A Buy Box diagnosis that finds SKUs losing the Featured Offer and the likely cause (priced out, out of stock, or fulfilment) so you can win it back, from DataDoe buy-box and price data. | Sellers who see sales drop while traffic holds and need to know why they lost the Buy Box and exactly what to fix. |
| `amazon-listing-optimizer` | 🔍 Read-only | 🔌 MCP | 📊 Report | Listings & Content | A 2026-ready listing audit that benchmarks your search funnel against the market (impressions, clicks, cart-adds, purchases), separates an exposure problem from a copy problem, checks the title against the 75-char cap and COSMO/Rufus intent coverage, and returns an upload-ready title, bullets, backend terms and attribute fixes, from DataDoe SQP, catalog and listing data. | Sellers and agencies who want a data-driven listing rewrite that says exactly what to fix first and why, aligned with Amazon's latest title, ranking and AI-search rules. |
| `suppressed-inactive-listings-check` | 🔍 Read-only | 🔌 MCP | 📊 Report | Listings & Content | A catalog-wide scan for listings that are silently not selling - suppressed, inactive, stranded (stock on hand but not buyable), or carrying an error/quality issue - ranked by the revenue at risk so you fix the costly ones first, from DataDoe listing status, issues, offer, inventory and sales data. | Sellers who want a fast weekly "is anything broken right now" sweep that surfaces the few blocked listings actually costing sales, not a wall of dead SKUs. |
| `ppc-negative-keyword-applier` | ✍️ Write (approval-gated) | 🔌 MCP | ⚡ Action | PPC & Ads | Finds the exact Sponsored Products search terms burning budget with no sales and adds them as negative keywords through DataDoe Actions - a dryRun preview first, a real change only on your approval - so you stop paying for clicks that never convert. | Sellers and agencies who want to act on wasted PPC spend, not just see it: turn dead search terms into negatives safely, from chat. |
| `ppc-bid-optimizer-apply` | ✍️ Write (approval-gated) | 🔌 MCP | ⚡ Action | PPC & Ads | Recomputes Sponsored Products keyword bids toward a target ACoS and applies them through DataDoe Actions - dryRun preview first, real change only on your approval - cutting bids on bleeders and nudging up profitable keywords. | Sellers and agencies who want weekly bid tuning that actually writes the changes back to Amazon, safely and one step at a time. |
| `amazon-asin-search-auditor` | 🔍 Read-only | 🔌 MCP | 📊 Report | Search & SEO | A dashboard report that audits an Amazon seller's organic and sponsored search visibility using DataDoe search-term data, live search results, owned-ASIN matching, and screenshots. | Teams that need to run a search-visibility audit for a specific seller to identify ASIN/rank gaps and understand organic vs. sponsored placement. |
| `keyword-rank-sqp-tracker` | 🔍 Read-only | 🔌 MCP | 📊 Report | Search & SEO | A week-over-week tracker of your money keywords - organic rank plus your share of the query (impressions, clicks, purchases) - that flags terms slipping, lost, rising or emerging before the sales drop shows, and degrades to a baseline on accounts with little SQP history, from DataDoe weekly Search Query Performance. | Sellers who want an ongoing "am I losing rank on the keywords that matter" watch, not a one-time audit, with a short alert list ordered by what costs money. |

## Installation with skills CLI
To install selected skill from this repository use the following command:
```bash
npx skills@latest add Deltologic/datadoe-ai-skills --skill SKILL_NAME
```

## External Links

- [DataDoe AI Agents & Skills (Hub)](https://app.datadoe.com/hub/ai-agents-and-skills)
- [DataDoe MCP overview](https://app.datadoe.com/hub/docs/datadoe-mcp/overview)
- [DataDoe Data Scheme browser](https://app.datadoe.com/hub/data-scheme)
- [DataDoe Documentation](https://app.datadoe.com/hub/docs)
- [DataDoe API Documentation](https://api.datadoe.com/api/v1/docs)
- [DataDoe Data Scheme Reference](https://api.datadoe.com/api/v1/spec/data-scheme)

## Contact

For questions, feedback, or collaboration requests, email: [contact@datadoe.com](mailto:contact@datadoe.com)
