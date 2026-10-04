# Mana Showdown prototype

A mana-and-spell experiment on the `mana-showdown` branch. Race an AI opponent on Easy, Medium or Hard. JavaScript, Three.js, Vite and GSAP; state is kept in memory.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` creates `dist`; `npm run preview` serves it. `npm test` checks rules, abilities, spell races, damage, undo, and existing presentation helpers.

## Rules and controls

## Prototype rules

- Each player starts with four empty tableau columns and 36 draw cards: two A–9 sets of diamonds and two A–9 sets of spades, with no additional cards. There is no life deck or Hearts suit.
- Stack cards in alternating red/black descending runs. Add at either end. Aces serve as 10 above a 9 or 1 below a 2; runs cannot wrap through an Ace. Any card can start an empty column.
- Fire, Earth, Water and Life columns each provide one charge per card. Moving cards redistributes their charge.
- Four shared spells are available, one per magic type. Fire, Earth and Water require runs of 4, 5, 6, 7, 8 or 9 cards, dealing 5, 10, 20, 30, 40 or 50 damage respectively. Life always restores 10 HP for 4 charges, capped at 100 HP.
- Spending an Ace on a damage spell adds a single 10 HP damage bonus. A spent Ace also adds 10 HP to Life healing (20 HP total, capped at 100 HP). Unspent Aces do not receive the bonus. The bonus uses the existing combo animation.
- The second consecutive damage spell by the same player adds 5 HP damage (2x combo), the combo banner and the existing combo recording. The third attack adds 15 HP damage (3x combo) and the two-avatar cinematic, with the actual HP lost split into at most 30 hits: the first 29 use damage divided by 30, rounded down, and the final hit takes the remainder (40 damage = 29 × 1 HP + 11 HP). Damage below 30 uses one hit per HP. Completing 3x resets combo progress to zero; the next attack begins a fresh three-attack cycle. Interrupting the opponent after their second attack, before the third, triggers the Combo Break sound and banner and awards a combo-break score. Interrupting after the first attack, before 2x, shows a Denied banner without an announcement sound. The Denied clip is not loaded. An opponent attack starts a new streak; moves, draws and Life casts do not affect it. Ace and combo bonuses add together: +15 HP on the second attack with an Ace, or +25 HP on the third.
- Casting returns exactly the spent cards to the draw deck and shuffles it. Remaining cards retain their charge. Damage spells start at cost 4 and grow to costs 5, 6, 7, 8 and 9 after successive casts, staying at 9. Each shared slot advances independently, regardless of which player casts. Life stays unchanged.
- Draw three, play the exposed waste card, and recycle an empty draw deck. Pull an Ace, Draw One and Shuffle retain their cooldowns. Shuffle combines stock and waste while preserving tableau cards.
- Win by reducing the opponent to 0 HP. Undo reverses your own actions while preserving later opponent moves and damage.

## Implementation and tuning

`game.js` owns rules. Edit `SPELLS` to tune costs and damage (currently 5–50 HP). `charges` derives each column’s stored charge; `castSpell` spends cards and shuffles them into stock. `main.js` renders clickable spells and element-themed electric charge circles (red Fire, green Earth, blue Water, white Life) with white numbers above each column. Each player owns independent spell tiers, starting at cost 4 and advancing to 9 after their own casts. The four spell sigils align with those same columns, show both players’ charge dots on their respective top/bottom sides, with their effect values beside the central icon, and signal readiness with colored glow, rotating rings and particles. Spell names and status labels are hidden; accessible labels describe the spell and its readiness. Charge gains trigger short spark bursts; spending, undo and resize do not. Reduced-motion settings suppress these bursts. Cards use traditional mirrored number/symbol corners and pip layouts: black spades and red diamonds. These symbols are decorative; rules still use only color and rank. `mana-icons.js` provides element icons for spell costs. `opponent.js` builds mana, casts spells, and uses abilities. It builds stacks toward current spell costs and draws when no useful placement is available. Tableau cards move between columns only when the move unlocks an immediately castable, useful spell. It prioritizes lethal attack sequences (including Ace and combo bonuses) and prioritizes healing only below 40 HP. At 40 HP or above it neither casts healing spells nor builds Life stacks; lethal attacks still take priority below the threshold. Easy thinks every 1.8–4 seconds with a 20% missed-turn chance; Medium every 1.5–3.5 seconds with 15%; Hard every 0.4–1.5 seconds with 5%. AI pauses during dialogs, dragging and combat cinematics. Undo preserves opponent cards, spell progression, score and damage, even when they act between your moves. Removing a heal can expose lethal damage already dealt by the opponent.

Three.js prefers WebGPU and falls back to WebGL 2; append `?webgl` to force WebGL. Cards use procedural textures. Existing portraits, audio, damage effects, and reduced-motion handling remain. No networking or saved matches.

## HP-based portrait changes

Both portraits progress to jacket-off action artwork at 75 HP or lower and sporty bikini artwork at 30 HP or lower. Each character keeps the furthest stage reached for the rest of the round, including after healing or undo. New games restore the original artwork without a flash. Each artwork change produces a short energy flash; reduced-motion preferences disable flashes. Images are preloaded and stale loads cannot overwrite a later stage or reset.

With Vite running, `/tests/portrait-preview.html` provides an isolated visual check of HP thresholds, healing persistence, and reset. `tests/portraits.test.js` checks strict thresholds, independent character progression, descriptions, flash frequency, reset, loading races, and reduced motion.
