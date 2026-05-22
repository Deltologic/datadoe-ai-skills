# DataDoe AI Skills

[![skills.sh](https://skills.sh/b/deltologic/datadoe-ai-skills)](https://skills.sh/deltologic/datadoe-ai-skills)

Public library of reusable AI skills that help users go from **one prompt to a working MVP/PoC app** powered by the DataDoe API.

Each skill is a practical blueprint you can use in coding agents (for example Cursor, Codex, Claude Code, Aider) to scaffold a ready-to-run application flow.

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

| Skill | What it builds | Best for |
| --- | --- | --- |
| `create-orders-manager` | A complete single-page Orders Manager app with seller/vendor picker, orders table with nested line items, filtering, local tagging, and robust DataDoe export/poll/download flow. | Teams that need a fast operational dashboard for order analysis and workflows. |
| `create-amazon-reconciliation-dashboard` | A self-contained interactive Amazon Reconciliation Dashboard with month switching, KPI cards, charts, a daily summary table, and an Order Explorer for reconciling Amazon orders against settlements. | Teams that need to compare Amazon orders and settlements across a 6-month window with clear cross-month reconciliation. |
| `weekly-sales-briefing` | A polished interactive HTML weekly sales briefing card with KPI tiles, top 5 SKUs, biggest week-over-week drops, and concise AI-generated insights from DataDoe exports. | Sellers and operators who need a fast weekly performance recap with clear trend signals and SKU-level highlights. |
| `amazon-asin-search-auditor` | A dashboard report that audits an Amazon seller's organic and sponsored search visibility using DataDoe search-term data, live search results, owned-ASIN matching, and screenshots. | Teams that need to run a search-visibility audit for a specific seller to identify ASIN/rank gaps and understand organic vs. sponsored placement. |

## Installation with skills CLI
To install selected skill from this repository use the following command:
```bash
npx skills@latest add Deltologic/datadoe-ai-skills --skill SKILL_NAME
```

## External Links

- [DataDoe Documentation](https://app.datadoe.com/hub/docs)
- [DataDoe API Documentation](https://api.datadoe.com/api/v1/docs)
- [DataDoe Data Scheme Reference](https://api.datadoe.com/api/v1/spec/data-scheme)

## Contact

For questions, feedback, or collaboration requests, email: [contact@datadoe.com](mailto:contact@datadoe.com)
