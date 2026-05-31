<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

read this @AGENTS.md

<!-- harness:refactor-frontend:start -->
# Refactor Harness — `refactor/frontend-client-layer`

Active multi-plan frontend refactor. The full harness (scope boundary, verification workflow, tool safety, lifecycle handoff) lives in **AGENTS.md → "Refactor Harness"**. Key invariants:

- **Do NOT change**: API envelope `{ success, data, message }`, route paths/handlers (`src/routes/**`), KV storage logic. In scope: `src/client/**`, `src/components/**`, and the two cron defects only.
- **Done = green**: `bun run lint && bun run typecheck && bun run test && bun run build` (+ `bun run test:coverage` ≥80% per-file). `test:visual` is the **local** PV human-review diff (untracked darwin baselines), not part of the automated/CI gate — see AGENTS.md.
- **State of record**: `docs/superpowers/plans/` (S0 → visual harness → lib ∥ cron → islands → PV → cleanup). Hard user gates: PV visual selection + final sign-off.
- **High-risk (authorize first)**: real KV writes, `wrangler deploy`, releases, `git push`/PR.
<!-- harness:refactor-frontend:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **subs-tracker** (1498 symbols, 2741 relationships, 116 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/subs-tracker/context` | Codebase overview, check index freshness |
| `gitnexus://repo/subs-tracker/clusters` | All functional areas |
| `gitnexus://repo/subs-tracker/processes` | All execution flows |
| `gitnexus://repo/subs-tracker/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
