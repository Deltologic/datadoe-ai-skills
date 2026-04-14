# DataDoe AI Skills

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

## External Links

- [DataDoe API Documentation](https://api.datadoe.com/api/v1/docs)
- [DataDoe Data Scheme Reference](https://api.datadoe.com/api/v1/spec/data-scheme)
- [Repository License (MIT)](./LICENSE)

## Contact

For questions, feedback, or collaboration requests, email: [contact@datadoe.com](mailto:contact@datadoe.com)

## CLI (In Progress)

We are currently working on a CLI that will let you import a chosen skill directly with an `npx` command.  
This feature is in progress and will be announced soon with exact package name and usage.