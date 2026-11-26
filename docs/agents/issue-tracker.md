# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `kindyakov/anyko`.
Run every `gh` command through the agent launcher, with the key path set as in
[GitHub protection](../engineering/github-protection.md#github-app-агента):
`bun run agent:github gh ...`. If the launcher fails, stop and report the error.

## Operations

- Create: `bun run agent:github gh issue create --title "..." --body-file <file>`
- Read: `bun run agent:github gh issue view <number> --json number,title,body,labels,comments`
- List: `bun run agent:github gh issue list --state open`
- Comment: `bun run agent:github gh issue comment <number> --body-file <file>`
- Apply or remove a label: `bun run agent:github gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: post an explanation, then run `bun run agent:github gh issue close <number>`.

Pass multi-line bodies as a file (`--body-file`). The repository is public:
issue text contains only synthetic data.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

When a skill says "publish to the issue tracker", create a GitHub issue.
When a skill says "fetch the relevant ticket", read the corresponding issue.
