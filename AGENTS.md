<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Git commit messages

Every change synced to GitHub must have a **specific, human-readable commit message**.
Never use generic messages like `Changes`, `Update`, or `Fix`.

### Title (required, ≤72 chars)

Use imperative mood and a type prefix:

`type(scope): what changed and why it matters`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `a11y`, `i18n`

Examples:

- `feat(practice): add Part 2 cue card speak timer with aria-live updates`
- `fix(auth): disable email confirmation for hackathon signup flow`
- `a11y(home): announce prep timer milestones to screen readers`
- `i18n(landing): move hero copy into en/landing.json keys`

### Body (required when touching 2+ files or non-trivial logic)

Leave a blank line after the title, then bullet points:

- What changed (routes, components, API, schema)
- Why (user-facing behavior, bug, a11y, i18n)
- Notable files if helpful

Example:

```
feat(practice): scaffold Part 2 speak route with recording UI

- Add /practice/part-2/speak route and ConversationShell layout
- Stack video + cue card vertically below md breakpoint
- Wire 60s prep timer with visible countdown and aria-live
```

### Scope hints

| Area | scope examples |
|------|----------------|
| Routes / pages | `home`, `mock`, `practice`, `onboarding`, `landing` |
| Shared UI | `shell`, `nav`, `ui` |
| Backend | `backend`, `assessment`, `tavus` |
| Infra | `supabase`, `auth`, `deps` |
