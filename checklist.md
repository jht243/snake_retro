# OpenAI Apps SDK — Game Widget Checklist

Requirements specific to shipping an interactive game as a ChatGPT widget (iframe).

## Iframe Focus & Input

- [x] Game does **not** auto-start on load — waits for an explicit user click
- [x] Idle screen shows **"Click to Start"** so the user knows to click into the iframe
- [x] When the iframe loses focus mid-game, the game **auto-pauses** and shows "Click to Resume"
- [x] Keyboard events are only processed when the container has focus (`tabIndex={0}`, `onKeyDown`)
- [x] Touch / pointer controls (D-pad) work without requiring keyboard focus

## Visual Feedback & Dopamine

- [x] Animated toast messages for exciting moments (zoom-in, hold, fade-out)
- [x] "That Was Close!" toast when eating food within 1 cell of a wall
- [x] "Combo x3/x5/x7!" toasts for eating food quickly in succession (within 2.5s window)
- [x] Milestone toasts at 50, 100, 200 points
- [x] Level-up toast on each new level
- [x] Particle burst on every food eat (colored to match active skin)
- [x] Screen flash (board glow) on food eat
- [x] Screen shake on combo x5+ and game over
- [x] Pulsing combo counter badge visible during active combos
- [x] "New High Score!" toast on personal best

## Global Leaderboard

- [x] Leaderboard tab with 10 ranked entries
- [x] Dummy player data with fun usernames pre-populated
- [x] Player's high score auto-inserted and ranked among dummy data
- [x] Player entry highlighted in green with "(You)" label
- [x] Medal icons for top 3 positions

## Badge / Achievement System

- [x] 16 badges covering food milestones, score milestones, combos, games played, snake length
- [x] Badge progress persisted in `localStorage`
- [x] Badge unlock triggers a purple toast notification with badge icon
- [x] Badges tab shows all badges in a grid — earned vs locked styling
- [x] Badge tooltips with name and description
- [x] Day-1 to day-7 achievable badges (first bite, 10 food, play 5 games, combos, etc.)

## Point System

- [x] 1 point earned per food eaten (separate from score)
- [x] Points persist across sessions in `localStorage`
- [x] Points displayed in header with coin icon
- [x] Points earned summary shown on game over screen

## Skins & Customizations

- [x] Shop tab **lights up with pulsing glow** the first time a user earns enough points to buy a skin
- [x] Glow is one-time only — persisted via `localStorage` so it never re-triggers
- [x] Toast notification "You can buy a skin!" accompanies the glow
- [x] Clicking the Shop tab dismisses the glow
- [x] 6 skins: Classic (free), Ocean Wave (50), Neon Pulse (75), Fire Trail (100), Rainbow (150), Golden King (200)
- [x] Each skin changes head color, body gradient, and glow color
- [x] Trail effects: fire glow, neon pulse, rainbow hue shift, gold sparkle
- [x] Shop tab with preview swatches for each skin
- [x] Buy button (deducts points) and equip button (free once owned)
- [x] Currently equipped skin highlighted with green border
- [x] Unaffordable skins show red price, disabled buy button
- [x] Skin ownership persisted in `localStorage`

## Retro Arcade Aesthetic

- [x] Pixel font ("Press Start 2P") loaded via Google Fonts for all UI chrome
- [x] Neon glow text shadows on headers, labels, scores, and active tab elements
- [x] Pixel-art borders (2px solid, sharp corners) on game board, stats, tabs, shop cards, badges
- [x] Retro color palette: neon green, electric blue, hot pink, gold, purple on dark navy
- [x] Chunky uppercase lettering with wide letter-spacing throughout
- [x] Retro-styled scrollbar (thin, purple thumb on dark track)
- [x] Game board has indigo border with ambient glow
- [x] Overlays (idle, paused, game over) use pixel font with arcade-style messaging
- [x] Tab bar uses per-tab accent colors with glow on active state
- [x] D-pad buttons styled with indigo pixel borders to match arcade feel
- [x] Gameplay rendering (snake, food, grid) left untouched — retro styling is chrome-only

## Gameplay UX

- [x] Game state transitions are clear: idle → playing → paused → gameover
- [x] Score, high score, and level visible at all times
- [x] High score persists across sessions via `localStorage`
- [x] Game over screen shows final score and offers "Play Again"
- [x] Tab bar (Game / Leaderboard / Badges / Shop) below game board

## Widget / MCP Integration

- [x] Widget HTML is fully self-contained (inlined JS bundle, no external fetches required)
- [x] `structuredContent` passes difficulty and board config so the widget can hydrate from tool args
- [x] `openai:set_globals` late-hydration listener re-renders with new config
- [x] `text/html+skybridge` MIME type used for resources
- [x] `_meta` includes `openai.com/widget` resource embedding for reliable hydration

## Performance

- [x] No heavy computation on load — game loop only starts after user clicks Start
- [x] `setInterval` cleaned up on unmount and pause
- [x] Board rendering uses refs for hot-path state to avoid stale closures
- [x] Particles animated via `requestAnimationFrame` and auto-removed when life expires
- [x] Toasts auto-cleaned after 1.6s

## Accessibility & Mobile

- [x] On-screen D-pad shown for touch devices
- [x] Pause button always reachable without a keyboard
- [x] Container has `tabIndex={0}` and `outline: none` for clean focus ring
