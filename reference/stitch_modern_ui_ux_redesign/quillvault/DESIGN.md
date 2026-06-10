---
name: QuillVault
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#464554'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#5d5e60'
  on-secondary: '#ffffff'
  secondary-container: '#dfdfe0'
  on-secondary-container: '#616364'
  tertiary: '#006b2d'
  on-tertiary: '#ffffff'
  tertiary-container: '#00873b'
  on-tertiary-container: '#f7fff3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e2e2e3'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
  light-background: '#FAFAFA'
  light-surface: '#FFFFFF'
  light-border: '#E4E4E7'
  light-text-primary: '#09090B'
  dark-background: '#09090B'
  dark-surface: '#18181B'
  dark-surface-raised: '#27272A'
  dark-border: '#3F3F46'
  dark-accent: '#818CF8'
  destructive: '#EF4444'
  warning: '#F59E0B'
typography:
  display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  heading-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  heading-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  transcript:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  sidebar-width: 240px
  chat-width: 320px
  titlebar-height: 32px
---

## Brand & Style

The design system for this desktop application is rooted in the **Modern Desktop** aesthetic, prioritizing professional reliability with a technical edge. It is designed for high-intensity productivity, catering to users who require clarity during long sessions of transcription analysis and meeting review.

The visual language balances **Minimalism** with **Corporate Modern** sensibilities. It utilizes generous white space (or "void space" in dark mode) to prevent cognitive overload, paired with sharp, intentional accents of Indigo to guide the user's eye toward primary actions. The inclusion of monospaced typography for data-heavy sections creates a "developer-tool" level of precision, while soft rounded corners and subtle elevation maintain an approachable, contemporary feel. The emotional response should be one of "effortless organization" and "trusted intelligence."

## Colors

The color architecture is functional and adaptive. It uses a high-contrast foundation to ensure legibility across varied lighting conditions typical of desktop environments.

- **Primary (Indigo):** Used for brand presence and primary calls to action. In Light Mode, it uses a deep Indigo-500; in Dark Mode, it shifts to a more luminous Indigo-400 to maintain vibrancy against dark neutrals.
- **Surface Strategy:** Layers are defined by subtle shifts in lightness rather than heavy shadows. The `surface-raised` token is used specifically for structural elements like sidebars and utility panels to create clear functional zoning.
- **Semantic Feedback:** Success (Emerald), Warning (Amber), and Destructive (Red) colors are reserved strictly for status communication—such as recording indicators or processing states—and should never be used decoratively.

## Typography

This design system employs a dual-font strategy to differentiate between the application interface and the user's generated content.

1.  **Inter (UI):** Used for all navigational elements, buttons, and system messaging. It is selected for its exceptional legibility and neutral character, allowing the content to remain the focus.
2.  **JetBrains Mono (Content):** Specifically utilized for transcription text, code blocks, and timestamps. The monospaced nature ensures that timestamps align perfectly and provides a distinct visual container for AI-generated analysis, separating it from the UI "chrome."

For transcriptions, use a relaxed line-height of `1.6` to facilitate long-form reading and scanning. All headings should use a tighter line-height to maintain a compact, "desktop-app" footprint.

## Layout & Spacing

The layout follows a **Fixed-Fluid-Fixed** structure, characteristic of modern productivity tools.
- **Left Sidebar:** A 240px fixed navigation rail for file management and organization.
- **Main Canvas:** A fluid central area that hosts the transcription and waveform visualizers.
- **Right Panel:** A 320px fixed chat/AI analysis panel that can be toggled to expand the main canvas.

The system adheres to an **8px grid**. All component dimensions, margins, and paddings must be multiples of 8 (with 4px reserved for micro-spacing like badge padding). This ensures a predictable vertical rhythm across the high-density interface.

**Breakpoints:**
- Below 1100px: Auto-hide the Right Panel.
- Below 900px: Collapse the Sidebar to an icon-only rail (56px).

## Elevation & Depth

Depth is conveyed through a combination of **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** The base application floor.
- **Level 1 (Surface):** Cards and content containers. Use `shadow-sm` in light mode; in dark mode, use a 1px border with a slightly lighter surface tint (`--surface-raised`) instead of shadows.
- **Level 2 (Raised):** Floating elements like dropdowns and popovers. These utilize `shadow-lg` with a 10% opacity tint to create a sense of being physically above the interface.

In Dark Mode, physical depth is primarily communicated through border contrast and subtle "inner-glow" effects on buttons, as diffused shadows become less effective.

## Shapes

The shape language is "Softly Geometric."
- **Standard Radius (8px):** Applied to inputs, dropdowns, and small card elements. This provides a modern, friendly feel without sacrificing the professional grid-alignment.
- **Container Radius (12px):** Used for large panels and the main content area to frame the core experience.
- **Interactive Radius (Full):** Avatars, pill-shaped status badges, and recording toggles use a fully rounded "pill" shape to distinguish them as highly interactive or distinct status markers.

## Components

- **Buttons:** Primary buttons use a solid Indigo background with white text. Secondary buttons use the `surface-raised` background with a subtle border. Hover states should trigger a 100ms background-color shift to a deeper indigo or neutral gray.
- **Input Fields:** Use 8px rounded corners with a 1px border. On focus, apply a 2px Indigo border with a soft 2px outer glow (focus ring).
- **Cards:** Utilize the 12px radius. Cards in the transcription feed should have a colored left-border accent to identify different speakers (e.g., Speaker 1 = Indigo, Speaker 2 = Emerald).
- **Transcription Blocks:** Grouped by speaker. Use JetBrains Mono for the text body. Include a subtle "play" icon that appears on hover over any paragraph for instant audio playback.
- **Waveform Visualizer:** Dual-color tracks (Indigo/Emerald) with a central playhead. The background of the visualizer should be the `surface-raised` color to distinguish it from the transcript background.
- **Status Badges:** Small, 4px rounded tags. Use high-contrast combinations: Emerald background with dark text for "Success/Live", and Amber background for "Processing".