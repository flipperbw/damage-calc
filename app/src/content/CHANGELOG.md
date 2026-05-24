## 2026-05-24

- **Empty Teams screen reborn.** Land on a sparkle hero with Create + Import CTAs and three preset tournament teams (Altkyle Rain, imstone Sand, Feis Fairy Spam) you can use in one tap.
- **In-app feedback.** Settings → Send feedback. Posts straight to me via Web3Forms — no GitHub account needed.
- **Trick Room-aware suggestions.** Builder detects a TR team (any drafted mon with Trick Room or active field state) and re-ranks counter suggestions with a slow-mon bias so slow nukers float to the top.
- **Counter-scoring fix.** Stopped claiming "Immune to all damaging moves" when the focused threat had no damaging moves modelled. A yellow warning chip now flags incomplete threats.

### Polish

- Opponent picker on the main BattleScreen now auto-synthesizes a build when you pick a species with no curated set (Primarina no longer lands with empty moves).
- Mega sprite path fixed for irregular formes — Mega Floette and Mega Magearna-Original render correctly via the MEGA_STONES lookup.
- Settings tab is now an icon-only gear on both mobile and desktop.
- Showdown import textarea bumped to 16px so iOS doesn't auto-zoom on focus.
