## 2026-06-18

- **Regulation M-B.** Added the new regulation's roster: 22 newly-legal Pokémon (Annihilape, Gholdengo, Grimmsnarl, Metagross, Swampert, Sceptile, Blaziken, Mawile, and more) plus 15 new Mega Evolutions, with their abilities (including Fire Mane and Eelevate). The current regulation now shows as a badge on the site logo.
- **New held items, with correct damage.** Life Orb (1.3×), Muscle Band / Wise Glasses (1.1×), Expert Belt (1.2× on super-effective), and Metronome now calculate properly; plus weather rocks, Light Clay, Big Root, Iron Ball, Shed Shell, Wide/Zoom Lens.
- **M-B move and balance changes.** New moves (Rage Fist, Make It Rain, Spirit Break, ...) and tweaks (Make It Rain now drops Special Attack two stages; Metagross loses Heavy Slam; Sceptile gains Earth Power).
- **Forme learnset fix.** Cosmetic formes that share a base learnset (e.g. Gourgeist-Super) no longer show an empty move list.
- **Chance-to-OHKO badge.** A move with a % chance to OHKO now gets its own orange badge and row tint, slotting between a guaranteed 2HKO (yellow) and a guaranteed OHKO (red) instead of rendering like a plain non-KO move.
- **No more misleading "100%" KO odds.** A near-certain but not guaranteed KO now caps at "99%" instead of rounding up to "100%"; 100% is reserved for truly guaranteed KOs.
- **M-B meta data.** Sets, top threats, candidate pool, and tournament teams now come from live Regulation M-B usage, with the new mons (Staraptor, Metagross, Gholdengo, Grimmsnarl, and more) ranked among the top threats.

## 2026-06-13

- **Quick battle without a team.** Battle screen lets you pick two Pokémon to compare even when you have no teams, with a prominent Create / Browse CTA on top and skeleton "Tap to pick" cards side-by-side below.
- **Empty team slots match the filled-tile height.** Slot rows no longer shrink when a team has no mons yet.
- **Latest meta refresh.** Pikalytics scrape re-run; 89 species with build variants and 20 fresh tournament-finisher teams.

## 2026-06-07

- **Spread damage toggle.** Doubles move sections get a `✥ Spread / ✥ Single` chip that swaps the 0.75× spread reduction for full single-target damage.
- **Weather-aware accuracy.** Hurricane / Thunder / *Storm hit 100% in Rain, 50% in Sun; Blizzard never misses in Snow.

## 2026-06-01

- **Pokepaste URL import.** Drop a `pokepast.es/<id>` link in the Showdown importer and the team loads automatically.
- **Format-aware suggestions.** Builder scores singles teams against singles threats, doubles against doubles.
- **Edit pencil on opponent card.** Top-left ✎ badge opens the MonEditor - makes editing the opponent's build discoverable.
- **Champions move legality.** Picker now sources from `@pkmn/ps`'s Champions learnsets - Froslass gets Nasty Plot, Floette-Eternal gets Light of Ruin, Sneasler stops cross-leaking Dragon Dance from regular Sneasel.

## 2026-05-30

- **Live Champions meta.** Sets, top threats, candidate pool, and Teams templates now come from real Pikalytics tournament data. Top threats grew 8 → 40; build dropdown tags meta variants as `META`.
- **Meta teams browser.** Permanent collapsible section on Teams with 20 tournament finishers and a search box (species / author / tournament).
- **Doubles threats lead the Builder.** Was Singles → Doubles, now Doubles → Singles.
- **Nav middle-click.** Tabs support middle-click and ⌘/Ctrl-click to open in a new browser tab.
- **Settings labelled on desktop.** Mobile keeps the icon-only gear.

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
