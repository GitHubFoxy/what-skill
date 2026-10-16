# what-skill

**what-skill** is a skill-selection assistant. It uses Jev or another suitable smart, fast model to examine a complete skill reference corpus and recommend which skills fit a user's current prompt.

The goal is to remove the need for the user to remember every available skill. The user should be able to ask for work normally; the selected model examines the request against the full catalog and the skill-related material in Lectures 1, 2, and 3, then returns candidates for review.

## Intended workflow

```text
User prompt
    ↓
Configured model (Jev or another suitable model) receives the complete skill corpus
    ↓
The model recommends applicable skills, with reasons and source references
    ↓
User verifies or edits the recommendations
    ↓
User passes the selected skill instructions to the working agent
    ↓
The working agent performs the task
```

The human review step is deliberate. The model recommends; the user decides which skills to pass to the working agent. This project does not automatically activate skills or perform the task on the user's behalf.

## Corpus: include every mention

The selected model must receive the whole source material, not only a hand-picked list of currently installed skills:

- `skills-catalog.md`, including every listed skill, principle, router, and other skill-like entry;
- Lecture 1, Lecture 2, and Lecture 3, including skill names and relevant discussion in their body text;
- source and version context when the material provides it.

The initial source files are maintained in the user's local notes:

- `~/personal/raw/Agent Skills Research 2026-10-12/skills-catalog.md`
- `~/personal/raw/Lecture/Lecture.md`
- `~/personal/raw/Lecture/Lecture 2 - Skills and Orchestration.md`
- `~/personal/raw/Lecture/Lecture 3 - Traces and Environment Improvement.md`

When preparing model input, preserve every mention and its source location. If the same skill appears in multiple sources, keep all occurrences or retain an explicit list of source references; do not silently discard mentions during deduplication. Keep similarly named skills from different sources distinguishable.

This includes entries that are not installed or enabled in the current agent runtime. A recommendation can identify a skill the user must fetch or provide separately. Corpus inclusion does not mean the skill is trusted, installed, or safe to execute.

## Decision model and provider reuse

Jev is one possible decision model, not a required dependency. The project should allow the decision model and provider to be configured so a smart, fast alternative can be used when it better fits the task, cost, latency, availability, or output requirements. Keep the selection workflow independent of any one model vendor or Jev-specific API.

The project is also intended to reuse the decision pattern from `better-axi`'s Jev implementation in a separate, focused project. The relevant source is currently `~/dotfiles/skills/better-axi/core/jev/`.

The reusable parts to study and carry over are:

- the provider-neutral decision client boundary and structured-choice pattern;
- provider fallback behavior and configuration patterns, adapted so providers and models can be changed;
- structured choices, validation, timeouts, and error reporting;
- deterministic mock/offline decision support where practical.

The current `better-axi` provider configuration recognizes these environment-variable names:

- `OPENROUTER_API_KEY`
- `AI_GATEWAY_API_KEY`, optionally `AI_GATEWAY_MODEL` and `AI_GATEWAY_PROVIDER`
- `CLOUDFLARE_ACCOUNT_ID` with `CLOUDFLARE_API_TOKEN`, optionally `CLOUDFLARE_AI_MODEL`

These are names only and describe the current `better-axi` implementation, not a restriction on future providers. Never commit credentials or `.env` files. The project should fail clearly if no decision provider is configured; it should not silently pretend a decision was made.

Model selection should account for both decision quality and speed. Keep the model configurable and record which provider/model produced each recommendation so results can be compared. Fallback to another configured provider/model should be explicit and observable.

## Model output

For each source skill entry, the selected model should make a structured relevance judgment against the user's prompt. A useful initial result shape is:

- **Recommended** — directly improves the requested work;
- **Maybe** — plausible, but depends on an assumption or would benefit from user confirmation;
- **Not applicable** — no meaningful connection to this prompt.

For each Recommended or Maybe result, include:

- the exact skill identity, preserving source or version if names collide;
- a short reason tied to the user's request;
- the source location in the catalog or lecture;
- any important invocation constraint or stated exclusion, when available.

Return the complete recommendation set for review, including uncertainty. Do not make the human inspect the source catalog again to recover why a skill was suggested.

## Product boundaries

- The configured model analyzes the user's prompt against the whole corpus; it does not filter candidates merely because a skill is absent from the active runtime.
- The user reviews the model's recommendations before passing selected skills to the working agent.
- The working agent receives the actual selected skill instructions, not only the model's short descriptions.
- Selection is advisory. It does not grant tools, permissions, or authorization for external actions.
- Preserve provenance: keep where each candidate came from and, when possible, which source revision it describes.
- Keep the project independent from `better-axi`; reuse its decision and provider-fallback patterns without coupling skill selection to browser automation or requiring Jev.

## Evaluation direction

Selection quality is more than whether the model returns an answer. Build a small evaluation set from realistic prompts with expected skill recommendations. Include:

- prompts where one or more skills are clearly useful;
- near-matches where a shared keyword should **not** trigger a skill;
- prompts that need several complementary skills;
- ordinary prompts where no special skill is needed;
- prompts where the best candidate is listed in the corpus but not currently installed.

Review missed useful skills, irrelevant recommendations, and correct abstentions separately. The user remains the final judge of the recommendations before they are handed to another agent.

## Current status

This repository starts as the project brief. The configurable model/provider interface, provider fallback, corpus ingestion, interface, and evaluation set are future implementation work. The separate-agent grilling/design review happens outside this project and is intentionally not reproduced here.
