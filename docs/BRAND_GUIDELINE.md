# RemitChain Brand & Design System Guideline

## 1. Brand Identity
- **Positioning:** Neo-bank precision for borderless stablecoin remittances and physical merchant cash-out.
- **Visual Direction:** **Obsidian & Mint** — deep obsidian surfaces, hairline borders, cobalt primary actions, and mint-emerald trust signals.
- **Avoid:** Neon/crypto purples (`#9945FF`), generic Tailwind indigo (`#6366F1`), continuous ambient bobbing/pulsing on static cards, browser `alert()` dialogs, and raw emojis in UI chrome.

---

## 2. Color System

| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg-canvas` | `#06090F` | Primary page & app background |
| `--bg-surface` | `#0D131F` | Cards, modals, sidebars, bottom sheets |
| `--bg-elevated` | `#161F30` | Hover states, active pills, input backgrounds |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Default 1px card & divider borders |
| `--border-active` | `rgba(255, 255, 255, 0.16)` | Focused inputs, hovered interactive cards |
| `--accent-primary` | `#2563EB` | Primary CTAs, active nav/tab indicators |
| `--accent-primary-hover` | `#3B82F6` | Hover/pressed state for primary CTAs |
| `--accent-mint` | `#10B981` | Verified booths, gas-sponsored badges, yield/payouts, 3D globe nodes |
| `--accent-mint-tint` | `rgba(16, 185, 129, 0.12)` | Mint badge & pill backgrounds |
| `--accent-danger` | `#EF4444` | Errors, rejected booths, inline validation |
| `--accent-warning` | `#F59E0B` | Pending review, simulation mode badge |
| `--text-primary` | `#F8FAFC` | Headings, balances, primary labels |
| `--text-secondary` | `#94A3B8` | Descriptions, subtitles, secondary labels |
| `--text-muted` | `#64748B` | Captions, timestamps, input placeholders |

---

## 3. Typography (`Neo-Bank Precision`)

| Role | Font Family | Weights | Rules |
| :--- | :--- | :--- | :--- |
| **Display & Headings** | `Plus Jakarta Sans` | `600`, `700`, `800` | Tracking `-0.025em`, line-height `1.15`–`1.25` |
| **Body & UI** | `Plus Jakarta Sans` | `400`, `500`, `600` | Line-height `1.5`, crisp hierarchy |
| **Numbers & Addresses** | `JetBrains Mono` | `400`, `500`, `600` | Always apply `font-variant-numeric: tabular-nums` on balances, APY, fees, and amounts |

---

## 4. Iconography
- **Library:** `@phosphor-icons/react` (Web) + `phosphor-react-native` (Mobile, paired with `react-native-svg`).
- **Weight Rules:**
  - `duotone`: Feature cards, empty states, status banners, and metric badges.
  - `fill`: Active navigation tabs and selected pills.
  - `regular`: Buttons, inline form inputs, and secondary actions.
- **Ban:** Never use raw OS emojis (`🏠`, `🏪`, `🕒`, `📋`, `⚡`, `🟢`) as UI icons.

---

## 5. Surfaces, Layout & Motion
- **Borders over heavy shadows:** Prefer `1px solid rgba(255, 255, 255, 0.08)` with subtle backdrop blur (`12px`) over heavy drop shadows.
- **Responsive grids:** All multi-column panels (including the 3D globe + sidebar) must stack cleanly below `900px`.
- **Purposeful motion:**
  - **Web:** `motion` (`AnimatePresence`, `layoutId` tab pills, `viewport={{ once: true }}` reveals) + `sonner` toasts.
  - **Mobile:** `react-native-reanimated` UI-thread transitions + `expo-haptics` tactile feedback.
  - **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for entrances; respect `prefers-reduced-motion`.
