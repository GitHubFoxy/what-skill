# what-skill

A minimal full-corpus skill selector and skill-combination research CLI built on [Pi](https://github.com/badlogic/pi-mono). No RAG, decision models, provider SDK, database, or server.

## Requirements

- Node.js 20+
- Pi CLI installed, with a configured and authenticated reasoning-capable model
- A local skill catalog and all three lecture documents

## Install

~~~sh
git clone https://github.com/GitHubFoxy/what-skill.git
cd what-skill
npm link
~~~

No npm dependencies are required.

## Use

~~~sh
what-skill "Build an agentic coding assistant"
what-skill analyze "Review this agent architecture" --model anthropic/claude-sonnet-4-5 --thinking high
what-skill analyze "Design a Go API" --json
what-skill stats
~~~

Pi controls all model configuration and authentication. Use --model, --provider and --thinking to override Pi defaults.

The default corpus paths come from the original project brief:

~~~text
~/personal/raw/Agent Skills Research 2026-10-12/skills-catalog.md
~/personal/raw/Lecture/Lecture.md
~/personal/raw/Lecture/Lecture 2 - Skills and Orchestration.md
~/personal/raw/Lecture/Lecture 3 - Traces and Environment Improvement.md
~~~

To override the defaults, pass --file for **every** desired source:

~~~sh
what-skill analyze "How should I test an agent?" \
  --file ./corpus/skills-catalog.md \
  --file ./corpus/lecture-1.md \
  --file ./corpus/lecture-2.md \
  --file ./corpus/lecture-3.md \
  --model openai/gpt-5
~~~

All specified files must exist and be nonempty. The CLI passes all of them to Pi using separate @file arguments. It never filters or truncates the corpus. If the selected model cannot handle the context, choose a larger-context model.

The research personality is explicitly supplied from AGENTS.md via Pi's --system-prompt flag. A one-shot analysis uses print mode, no tools, no Pi session history, no other context files, and no automatic skill discovery. Skill execution is deliberately out of scope.

## Research history

Every successful analysis adds a local record to .what-skill/history.jsonl (gitignored). The record contains the query, timestamp, corpus SHA-256, selected model/provider, recommendations, and proposed combinations. Use --no-history to disable logging or --history PATH to redirect it.

~~~sh
what-skill stats
what-skill stats --history ./other.jsonl
~~~

Statistics count **model recommendations**, not actual skill executions or confirmed skill usage. Only "recommended" skills count in frequency statistics; "maybe" does not. Combination statistics count model-suggested combinations. Human approval and agent execution traces can be added later.

## Development

~~~sh
npm test
~~~

Tests use a fake Pi executable. For local testing with another Pi binary, set WHAT_SKILL_PI to the executable path. Real model tests require Pi configured on your machine.
