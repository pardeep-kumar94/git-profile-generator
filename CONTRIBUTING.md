# Contributing to Subtext

Thanks for your interest in contributing! This is a small, no-build static project — contributions should stay in that spirit.

## Getting started

```bash
git clone https://github.com/<your-fork>/subtext.git
cd subtext
npm run dev   # serves src/ at http://localhost:5173
```

No build step, no bundler. Changes to `src/` are immediately reflected on refresh.

## What to work on

- Open issues labeled **good first issue** are a great starting point.
- For bigger changes, open an issue first to discuss the approach before writing code.

## Guidelines

- **Keep it vanilla.** No frameworks, no build tools, no new runtime dependencies.
- **One concern per PR.** Small, focused pull requests are easier to review and merge.
- **Test in browser.** Since there are no automated tests, manually verify your change works in a modern browser before submitting.
- **Match the existing code style** — 2-space indentation, single quotes, no semicolons in JS where avoidable.

## Submitting a pull request

1. Fork the repo and create a branch: `git checkout -b my-feature`.
2. Make your changes.
3. Open a PR against `main` with a clear description of what and why.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when opening an issue.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful.
