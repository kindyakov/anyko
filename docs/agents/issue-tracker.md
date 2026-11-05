# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `kindyakov/anyko`.
Use the `gh` CLI from this repository.

## Operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --json number,title,body,labels,comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Apply or remove a label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: post an explanation, then run `gh issue close <number>`.

Check the target with `gh repo view --json nameWithOwner` before creating an issue.
Create issues only in the user's own repository.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

When a skill says "publish to the issue tracker", create a GitHub issue.
When a skill says "fetch the relevant ticket", read the corresponding issue.
