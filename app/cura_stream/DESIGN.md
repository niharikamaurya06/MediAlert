# Design System Document: The Clinical Precision Framework

## 1. Overview & Creative North Star: "The Digital Caretaker"
The Creative North Star for this design system is **"The Digital Caretaker."** In the high-stakes world of medical IoT, the interface must bridge the gap between clinical authority and empathetic accessibility. 

We move beyond the "standard" medical app by rejecting the sterile, boxy layouts of traditional healthcare software. Instead, we utilize **Soft Minimalism**—an approach characterized by expansive white space, intentional asymmetry, and layered tonal depth. The goal is to create a sense of "digital calm." We achieve this through "breathable" layouts where information is revealed through hierarchy rather than density, making the technology feel like a supportive companion rather than a complex tool.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette is a sophisticated range of professional blues and off-whites, designed to evoke trust and high-tech precision.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Traditional lines create visual "noise" that adds to user anxiety. Boundaries must be defined solely through background color shifts or tonal transitions.
*   **Example:** A `surface-container-low` section sitting on a `surface` background provides all the separation necessary.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. We use the surface-container tiers to create "nested" depth:
*   **Background (`#f8f9fb`):** The canvas.
*   **Surface Container Low (`#f2f4f6`):** For secondary content areas.
*   **Surface Container Lowest (`#ffffff`):** For primary interactive cards, creating a "lifted" appearance against the off-white background.
*   **Surface Container Highest (`#e1e2e4`):** For subtle emphasis on inactive or disabled elements.

### The "Glass & Gradient" Rule
To elevate the "high-tech" aesthetic, use semi-transparent surface colors with a `backdrop-blur` (16px–32px) for floating elements like navigation bars or modal overlays. 
*   **Signature Textures:** Apply subtle linear gradients from `primary` (#00488d) to `primary_container` (#005fb8) for hero actions. This provides a "liquid" depth that feels premium and alive.

---

## 3. Typography: Editorial Authority
We use a dual-font strategy to balance technical clarity with a modern editorial feel.

*   **Display & Headlines (Manrope):** A geometric sans-serif that feels engineered yet approachable. Use `display-lg` (3.5rem) with tight tracking (-2%) for high-impact health scores or "Time to Dose" alerts.
*   **Body & Labels (Inter):** The gold standard for readability. Inter is used for all functional data and instructions.
*   **Intentional Asymmetry:** Use `headline-sm` (1.5rem) aligned to the left with generous top-padding to create an editorial "breathing room" that guides the eye naturally through the medication schedule.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "heavy" for a clinical environment. We use **Ambient Softness.**

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that mimics fine paper without the clutter of shadows.
*   **Ambient Shadows:** For floating action buttons or critical alerts, use a "Tinted Shadow." 
    *   *Values:* Offset: 0, 12px; Blur: 24px; Color: `on-surface` at 4%–6% opacity.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` (#c2c6d4) at **15% opacity**. Never use 100% opaque borders.
*   **Glassmorphism:** Use `surface_container_lowest` at 80% opacity with a blur to create a "frosted glass" medication tray effect.

---

## 5. Components: The High-Tech Kit

### Modern Cards
*   **Rule:** Forbid divider lines. Use vertical white space (`spacing-xl`) or subtle background shifts.
*   **Styling:** Use `rounded-lg` (1rem) for medication cards. The card background should be `surface-container-lowest` (#ffffff) to pop against the `background` (#f8f9fb).

### Intuitive Input Fields
*   **Styling:** Inputs should not have a bottom line or a full border. Use a filled `surface-container-high` background with a `rounded-md` (0.75rem) corner. On focus, transition the background to `primary_container` at 10% opacity with a `primary` "Ghost Border."

### Clear Toggle Switches
*   **Styling:** Use the `primary` color for the "On" state. The track should be oversized and pill-shaped (`rounded-full`), while the thumb should be a crisp `surface-container-lowest` (#ffffff).

### Buttons
*   **Primary:** Gradient-filled (`primary` to `primary_container`) with `on_primary` text. No shadow.
*   **Secondary:** `surface-container-high` background with `primary` text.
*   **Tertiary:** Transparent background with `primary` text; used for "Cancel" or "Dismiss."

### Signature Component: The "Dose Progress" Ring
A bespoke component for medicine IoT. A high-contrast `primary` ring against a `surface-container-highest` track, using `display-sm` Manrope in the center to show "Time Remaining."

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical layouts. For example, place a headline on the left and a status chip on the far right with no connecting line.
*   **Do** prioritize "negative space." If a screen feels crowded, increase the spacing rather than adding a container.
*   **Do** use `primary_fixed_dim` for icons to give them a sophisticated, "matte" blue look.

### Don't:
*   **Don't** use pure black (#000000). Use `on_surface` (#191c1e) for all text to maintain the "Soft Minimalist" feel.
*   **Don't** use standard "Material Design" shadows. They are too aggressive for a calm healthcare context.
*   **Don't** use 1px dividers to separate list items. Use a 12px or 16px gap instead.