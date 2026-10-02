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

## Architecture rules
- Booking integrity lives in PostgreSQL RPCs (advisory lock per workshop + transactional capacity count); UI and server functions never decide availability — prevents double-booking.
- Service categories are a closed list in src/lib/catalog.ts, shared by UI and AI classification — keeps AI output validatable.
- All colors/fonts are tokens in src/styles.css; components use semantic classes only — consistent theming.
