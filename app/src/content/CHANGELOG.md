## 2026-06-20

- **Inline boosts on the battle card.** Stat boosts now live right in the stat grid - each stat has +/- steppers and the displayed value updates live as you step a stage, so you no longer open a separate popup mid-battle. The grid is ordered Atk / SpA / Def / SpD / Spe, and status moved up next to ability/item/nature.
- **Reset battle state.** A reset button by the HP bar clears HP, boosts, and status back to fresh in one tap; it stays put (enabled only when there's something to reset) so the bar doesn't jump.
- **Opponent profile switcher.** A set picker on the opponent card lets you one-tap swap between curated meta builds (or the Auto build) for that species, keeping your current HP / status / boosts. Shares a row with the Deadliest / Tankiest buttons and opens as a bottom sheet.
- **Collapsible mon cards (mobile).** A chevron in the card corner tucks a mon down to just its sprite + name + types and hides its move rows, so you can focus the small screen on the other side.
- **Meta profiles for every mon, not just the top teams.** The opponent set picker now has profiles for all ~207 meta Pokémon (was ~70).
- **Opponent defaults to the most-used set.** Picking an opponent now auto-selects its single most common build (e.g. mostly-mega mons like Raichu default to their mega set, not a rare base set), and the set picker lists builds most-used first.
- **Mega sets get their real EVs.** Pikalytics omits EV spreads on mega-forme pages, so mega sets were calcing at base stats. The scraper now grafts the base species' actual spread onto each mega set (remapping the attack stat per forme, so Charizard-Mega-X stays physical and Mega-Y special).
- **Mega X/Y follows the held stone.** The mega toggle is a single Off/Mega control now; which forme you get (X vs Y) comes from the stone / chosen set rather than a separate X/Y switch that could contradict the item.
- **Bigger mobile nav tap targets.** The bottom-nav tabs are now 44px tall (was 40), meeting the standard minimum touch-target size.
- **Weather Ball shows its real type.** Weather Ball (and Terrain Pulse) now display the correct type and effectiveness in weather/terrain - Fire and super-effective in Sun, etc. - instead of always reading Normal. The damage was already correct.
- **Auto build is a fallback.** The synthesized "Auto" set only appears for off-meta mons with no curated profiles now, instead of always topping the list.

## 2026-06-19

- **Keyboard navigation in pickers.** Search pickers (species, item, ability, move, nature) now let you arrow up/down through the results and hit Enter to pick - keep typing to filter while the highlight tracks the top match.
- **Picker search polish.** Search boxes get a clear (x) button, a no-results message when nothing matches, and the Filters control is now an obvious bordered button instead of a tiny text link.

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
