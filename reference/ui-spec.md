# QuillVault v2 — UI Design Specification
> For use with AI UI generators (Google Stitch, Claude Designer, v0, etc.)

---

## 1. Product Overview

**QuillVault** is a Windows desktop application for recording, transcribing, diarizing, and summarizing meetings and conversations. It captures microphone and system audio separately, processes the audio through an AI pipeline, and presents the results in a structured document viewer with an integrated chat interface.

**Dual transcription architecture:**
- **Local mode** — Client-side Whisper (ONNX via `@huggingface/transformers`) runs in a Web Worker. Fast, private, works offline for transcription. Supports tiny/base/small/medium models.
- **Server mode** — Backend runs `faster-whisper` (large-v3). Higher accuracy, requires server connection.
- User selects mode per-recording or globally in Settings. Both modes use the same backend for diarization, speaker naming, and output generation.

**Core user journey:**
1. Record or upload audio
2. Choose transcription mode: **Local** (client-side Whisper) or **Server** (backend pipeline)
3. Wait for processing pipeline (transcription → diarization → speaker naming → output generation)
4. Review each pipeline output as tabs in the document viewer
5. Chat with the document
6. Export or copy results

---

## 2. Design System

### 2.1 Color Tokens

#### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#FAFAFA` | App background |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--surface-raised` | `#F4F4F5` | Sidebar, code blocks |
| `--border` | `#E4E4E7` | Dividers, input borders |
| `--text-primary` | `#09090B` | Headings, body |
| `--text-secondary` | `#71717A` | Labels, captions |
| `--text-muted` | `#A1A1AA` | Placeholders, disabled |
| `--accent` | `#6366F1` | Primary actions (indigo-500) |
| `--accent-hover` | `#4F46E5` | Button hover |
| `--accent-subtle` | `#EEF2FF` | Accent backgrounds |
| `--destructive` | `#EF4444` | Delete, error |
| `--success` | `#22C55E` | Connected, completed |
| `--warning` | `#F59E0B` | Processing, caution |
| `--recording` | `#EF4444` | Recording indicator |

#### Dark Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#09090B` | App background |
| `--surface` | `#18181B` | Cards, panels |
| `--surface-raised` | `#27272A` | Sidebar, code blocks |
| `--border` | `#3F3F46` | Dividers, input borders |
| `--text-primary` | `#FAFAFA` | Headings, body |
| `--text-secondary` | `#A1A1AA` | Labels, captions |
| `--text-muted` | `#71717A` | Placeholders, disabled |
| `--accent` | `#818CF8` | Primary actions (indigo-400) |
| `--accent-hover` | `#6366F1` | Button hover |
| `--accent-subtle` | `#1E1B4B` | Accent backgrounds |
| `--destructive` | `#F87171` | Delete, error |
| `--success` | `#4ADE80` | Connected, completed |
| `--warning` | `#FCD34D` | Processing, caution |

### 2.2 Typography

| Scale | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| `display` | Inter | 24px | 700 | 1.2 | Page titles |
| `heading-lg` | Inter | 18px | 600 | 1.3 | Section headings |
| `heading-md` | Inter | 15px | 600 | 1.4 | Card headers |
| `body` | Inter | 14px | 400 | 1.5 | Body text |
| `body-sm` | Inter | 13px | 400 | 1.5 | Secondary info |
| `caption` | Inter | 12px | 400 | 1.4 | Labels, timestamps |
| `mono` | JetBrains Mono | 13px | 400 | 1.6 | Transcript content |

**Font stacks:**
- Primary: `'Inter', system-ui, -apple-system, sans-serif`
- Monospace: `'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace`

### 2.3 Spacing Scale (8px base grid)

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px`

### 2.4 Border Radius

| Name | Value | Usage |
|------|-------|-------|
| `sm` | 4px | Badges, tags |
| `md` | 8px | Inputs, small cards |
| `lg` | 12px | Cards, panels |
| `xl` | 16px | Modals |
| `full` | 9999px | Pills, avatars |

### 2.5 Shadows (Light Mode)

```
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)
shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
```

### 2.6 Animation

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 100ms | Hover states |
| `duration-base` | 150ms | Transitions |
| `duration-slow` | 300ms | Page transitions, modals |
| `easing` | `cubic-bezier(0.16, 1, 0.3, 1)` | All transitions |

---

## 3. Layout Architecture

### 3.1 Application Shell

```
┌─────────────────────────────────────────────────────────────┐
│  TITLEBAR (custom, drag region)          [─] [□] [✕]        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌─────────────────────────────────────┐  │
│  │              │  │                                      │  │
│  │   LEFT       │  │         MAIN CONTENT AREA           │  │
│  │   SIDEBAR    │  │                                      │  │
│  │   (240px)    │  │                                      │  │
│  │              │  │                                      │  │
│  │              │  │                                      │  │
│  └──────────────┘  └─────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Custom titlebar:** 32px height, drag region across full width, window controls (minimize, maximize, close) right-aligned, app logo + name left-aligned.

**Left sidebar:** 240px fixed width, collapsible to 56px (icon-only mode), contains navigation and recording list.

**Main content area:** fills remaining width, scrollable.

---

## 4. Screens

### 4.1 Auth — Login

**Route:** `/auth/login`  
**Layout:** Full screen centered card, no sidebar

```
┌─────────────────────────────────────────┐
│                                         │
│         [LOGO]  QuillVault              │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  Sign in to your account          │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Email or username          │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Password              [👁] │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  [Forgot password?]               │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │        Sign In              │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  Don't have an account? [Sign up] │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**
- App logo (32px square icon + wordmark)
- Card: 400px wide, centered vertically and horizontally
- Heading: "Sign in to your account" (heading-lg)
- Email/username input with validation
- Password input with show/hide toggle
- "Forgot password?" text link (right-aligned, body-sm, accent color)
- Primary button: "Sign In" (full width, accent fill)
- Register link (body-sm, centered)
- Theme toggle (top-right corner, moon/sun icon)
- Error inline under each field (caption, destructive color)
- Loading spinner inside button on submit

---

### 4.2 Auth — Register

**Route:** `/auth/register`  
**Layout:** Full screen centered card

**Components (card contents):**
- Heading: "Create an account"
- Full name input (optional, placeholder: "John Doe")
- Username input
- Email input
- Password input + confirm password input
- Password strength indicator (4 segments: weak/fair/good/strong)
- Primary button: "Create Account"
- Login link: "Already have an account? Sign in"
- Same error/loading patterns as login

---

### 4.3 Auth — Forgot Password / OTP Reset

**Two-step card:**

**Step 1:** Email input + "Send Reset Code" button  
**Step 2:** 6-digit OTP input (6 individual character boxes, auto-focus next), new password + confirm, "Reset Password" button  
**Step 3:** Success state with "Back to Sign In" button

OTP input boxes: 48px × 56px each, monospace font, border highlight on focus, spaced 8px apart.

---

### 4.4 Dashboard (Home)

**Route:** `/`  
**Layout:** App shell with sidebar

#### Left Sidebar

```
┌──────────────────────┐
│  [☰]  QuillVault     │  ← App logo + collapse button
├──────────────────────┤
│  ┌──────────────────┐│
│  │ + New Recording  ││  ← Primary action button, accent fill
│  └──────────────────┘│
├──────────────────────┤
│  LIBRARY             │  ← Section label (caption, muted)
│                      │
│  🔍 Search...        │  ← Inline search input
│                      │
│  [All]  [Recent]     │  ← Filter pills
│                      │
│  ── Today ──         │  ← Date separator (caption, muted)
│  [📄] Meeting name   │  ← Recording item
│       14:32 · 45min  │
│  [📄] Recording name │
│       11:00 · 12min  │
│  ── Yesterday ──     │
│  [📄] Sprint review  │
│       ...            │
│                      │
│  [+ Upload Audio]    │  ← Secondary action
├──────────────────────┤
│  ─────────────       │
│  [⚙] Settings        │
│  [?] Help            │
│  [👤] Profile        │
└──────────────────────┘
```

**Recording list items:**
- 36px height
- Icon: document icon (16px, muted) left
- Title: body, primary text, truncated with ellipsis
- Metadata: date + duration, caption, muted text
- Active item: accent-subtle background, accent left border (2px)
- Hover: surface-raised background
- Processing item: shows animated pulse indicator + "Processing..." badge (warning color)

#### Main Content — Empty State

When no recording is selected:

```
┌─────────────────────────────────────────┐
│                                         │
│            [🎙 icon, 64px]              │
│                                         │
│        No recording selected            │
│                                         │
│   Select a recording from the sidebar   │
│   or start a new one                    │
│                                         │
│   ┌────────────────────┐                │
│   │  + New Recording   │                │
│   └────────────────────┘                │
│                                         │
└─────────────────────────────────────────┘
```

---

### 4.5 New Recording Screen (Modal)

**Type:** Full-screen overlay modal (not a dialog — takes over main content area)

```
┌─────────────────────────────────────────────┐
│  ← Back          New Recording              │
├─────────────────────────────────────────────┤
│                                             │
│  Recording Name                             │
│  ┌─────────────────────────────────────┐    │
│  │  Team Standup - June 2026           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         WAVEFORM VISUALIZER         │    │
│  │                                     │    │
│  │  ~~~~ mic channel (blue) ~~~~       │    │
│  │  ~~~~ sys channel (green) ~~~~      │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────┐ ┌─────────────────┐    │
│  │  🎤 Microphone  │ │ 🔊 System Audio │    │
│  │  ● Active       │ │  ● Active       │    │
│  │  Level: ||||    │ │  Level: ||      │    │
│  └─────────────────┘ └─────────────────┘    │
│                                             │
│  Audio Devices                              │
│  Mic: [Default Microphone ▾]                │
│                                             │
│  Transcription                              │
│  Mode: [● Local (Whisper)  ○ Server]        │
│  Model: [tiny ▾]  (only shown in local)     │
│  [ℹ Downloaded ✓] or [⬇ Download (39 MB)]  │
│                                             │
│  Duration: 00:04:32   [●● Rec]              │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  ⏸ Pause │  │  ⏹ Stop  │  │ Discard  │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  Language: [English ▾]                      │
│                                             │
└─────────────────────────────────────────────┘
```

**Transcription mode selector:**
- Two radio-style options: **Local (Whisper)** and **Server**
- Local: transcription runs in a Web Worker via `@huggingface/transformers` (Whisper ONNX)
- Server: transcription runs on the backend via faster-whisper (requires server connection)
- Model dropdown (local mode only): tiny (39 MB), base (74 MB), small (244 MB), medium (769 MB)
- Download status indicator: shows whether the model is cached in IndexedDB
- Language selector: affects both local and server transcription
- Setting persisted in Zustand store (`qv-transcription`) and also in Settings page

**Waveform visualizer:**
- Live real-time waveform, two overlaid lines
- Mic channel: indigo/accent color
- System audio channel: emerald/green color
- Height: 120px, dark background
- Shows last ~10 seconds of audio

**Channel status cards:**
- Two cards side by side
- "Active" status with green dot when signal detected
- Level meter: 4–8 animated vertical bars
- "Not detected" state if device unavailable (warning color)

**Recording states:**
- Pre-recording: large microphone icon, "Start Recording" single button
- Recording: timer, waveform active, Pause/Stop/Discard buttons
- Paused: timer frozen, "Resume" replaces "Pause", waveform static
- Stopped/Reviewing:
  - **Local mode**: "Transcribing locally…" progress bar → then "Sending transcript to backend…"
  - **Server mode**: "Sending to backend…" loader
  - Both modes then transition to the Document Viewer with processing pipeline status

---

### 4.6 Upload Audio Screen (Modal)

```
┌─────────────────────────────────────────────┐
│  ← Back          Upload Audio               │
├─────────────────────────────────────────────┤
│                                             │
│  Recording Name                             │
│  ┌─────────────────────────────────────┐    │
│  │  Auto-filled from filename...       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │        ↑ Drag & drop audio          │    │
│  │                                     │    │
│  │     MP3, WAV, M4A, FLAC, OGG        │    │
│  │          Max 2GB per file           │    │
│  │                                     │    │
│  │    [  Browse Files  ]               │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Selected: meeting.mp3 (47.2 MB)           │
│  ████████████████████░░░░░  82%            │
│  Uploading... 38.7 MB / 47.2 MB            │
│                                             │
│  Language: [English ▾]                      │
│  Template: [Meeting Minutes ▾]              │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           Upload & Process          │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

**Upload progress:**
- Chunked upload progress bar (accent fill)
- Bytes transferred / total
- Cancel button during upload
- Drag active state: border turns accent, background dims

---

### 4.7 Document Viewer (Main View)

This is the primary screen. Shown when a recording is selected in the sidebar.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Meeting Name  ·  June 9, 2026  ·  45 min   [⋮ Actions] │
├──────────────────────────────────────────────────────────┤
│                                    │                      │
│  [Processing Pipeline Status]      │   CHAT PANEL        │
│                                    │   (320px, toggle)   │
│  ┌────┬──────────┬───────┬───────┐ │                      │
│  │ 1  │    2     │   3   │   4   │ │                      │
│  │Raw │Diarized  │Named  │Output │ │                      │
│  └────┴──────────┴───────┴───────┘ │                      │
│                                    │                      │
│  ┌──────────────────────────────┐  │                      │
│  │                              │  │                      │
│  │   Tab Content Area           │  │                      │
│  │                              │  │                      │
│  └──────────────────────────────┘  │                      │
│                                    │                      │
└────────────────────────────────────┴──────────────────────┘
```

#### Header Bar

- Recording title (heading-md, editable on click)
- Created date + duration (caption, muted)
- Actions menu `⋮`: Export (PDF/DOCX/MD/TXT), Copy, Delete recording
- Chat toggle button: "💬 Chat" (right side), opens/closes chat panel
- Speaker manager button: "👥 Speakers" — opens speaker names editor

#### Processing Pipeline Status Bar

Shown below header, only when processing in progress or recently completed:

```
  [✓] Transcribed  →  [⟳] Diarizing  →  [ ] Naming  →  [ ] Output
```

- Each step: icon + label
- Completed: checkmark, success color
- Active: animated spinner, accent color
- Pending: dotted circle, muted color
- Failed: X icon, destructive color
- Clickable steps jump to that tab

#### Document Tabs

**Tab 1: Raw Transcript**
- Raw Whisper output, no speaker labels
- Monospace font, 14px, line-height 1.6
- Timestamps shown as `[00:01:23]` in muted color
- Copy button (top-right of content area)
- Find & replace bar (Ctrl+F)

**Tab 2: Diarized Transcript**
- Speaker labels: `Speaker 01:`, `Speaker 02:` etc.
- Each speaker gets a distinct subtle color tag (color-coded left border on each block)
- Speaker blocks separated by 8px gap
- Speaker label: caption, bold, speaker's assigned color
- Text: mono, body
- Timestamps inline: muted caption

**Tab 3: Speaker-Named Transcript**
- Same layout as Diarized, but `Speaker 01` → actual names (e.g. "Alice")
- Names are editable inline (click → input field)
- "Edit speaker names" button at top opens the speaker name editor dialog
- Changes saved and pipeline re-runs naming from diarized output

**Tab 4: Generated Output**
- Rendered markdown (not raw markdown)
- Clean document-like typography
- Template name shown as badge at top
- "Regenerate" button: opens template selector modal, re-runs with same or new template
- Section headings, bullet lists, bold properly rendered
- "Edit" toggle: switches between rendered and raw markdown editor

#### Chat Panel (320px, toggleable)

```
┌─────────────────────────────────┐
│  Document Chat  [✕]             │
├─────────────────────────────────┤
│                                 │
│  [system]  How can I help       │
│  you with this transcript?      │
│                                 │
│  [user]  What were the main     │
│  action items?                  │
│                                 │
│  [assistant]  There were 3      │
│  main action items:             │
│  1. John to send report...      │
│  2. ...                         │
│                                 │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │  Ask about this doc...  │    │
│  └─────────────────────────┘    │
│                    [Send ↑]     │
└─────────────────────────────────┘
```

- Chat messages: user messages right-aligned (accent-subtle background), assistant left-aligned (surface-raised)
- Code blocks in responses: monospace, surface-raised
- Loading: "thinking" animation (3 dots bouncing)
- Scrolls to bottom on new message

---

### 4.8 Speaker Name Editor (Dialog)

```
┌─────────────────────────────────────────────┐
│  Edit Speaker Names                     [✕] │
├─────────────────────────────────────────────┤
│  Assign names to identified speakers.       │
│  Changes will update the Named Transcript.  │
│                                             │
│  ● Speaker 01   ┌─────────────────────┐    │
│                 │ Alice Chen          │    │
│                 └─────────────────────┘    │
│  ● Speaker 02   ┌─────────────────────┐    │
│                 │ Bob Martinez        │    │
│                 └─────────────────────┘    │
│  ● Speaker 03   ┌─────────────────────┐    │
│                 │                     │    │
│                 └─────────────────────┘    │
│                                             │
│  [Sample Audio 02s] button per speaker     │
│                                             │
├─────────────────────────────────────────────┤
│  [Cancel]                  [Save & Apply]   │
└─────────────────────────────────────────────┘
```

- Each speaker: colored dot (matches transcript), label, name input
- "Play Sample" button: plays 2-second sample audio clip for that speaker
- Save triggers re-run of naming stage in backend

---

### 4.9 Template Manager Screen

**Route:** `/templates`  
**Layout:** App shell, no sidebar item selected

```
┌──────────────────────────────────────────────────────────┐
│  Templates                          [+ New Template]     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  BUILT-IN                                                 │
│  ┌─────────────────┐ ┌─────────────────┐                 │
│  │ 📋 Meeting      │ │ 📝 Summary      │                 │
│  │    Minutes      │ │                 │                 │
│  │ Built-in        │ │ Built-in        │                 │
│  └─────────────────┘ └─────────────────┘                 │
│  ┌─────────────────┐ ┌─────────────────┐                 │
│  │ ✅ Action Items │ │ 📧 Email Draft  │                 │
│  │ Built-in        │ │ Built-in        │                 │
│  └─────────────────┘ └─────────────────┘                 │
│                                                           │
│  MY TEMPLATES                                             │
│  ┌─────────────────┐ ┌─────────────────┐                 │
│  │ 🎯 Sprint       │ │ + New           │                 │
│  │    Retro        │ │                 │                 │
│  │ Custom  [⋮]     │ │                 │                 │
│  └─────────────────┘ └─────────────────┘                 │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Template cards:** 200px × 120px, icon + name + type badge  
**Built-in templates:** read-only, no delete option  
**Custom templates:** [⋮] menu with Edit / Duplicate / Delete options

#### Template Create/Edit (Full Panel)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back   Edit Template                                  │
├──────────────────────────────────────────────────────────┤
│  Template Name                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Sprint Retro Notes                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Icon  [🎯 ▾]   Category  [Meeting ▾]                    │
│                                                           │
│  System Prompt                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  You are analyzing a sprint retrospective          │  │
│  │  meeting transcript. Extract:                      │  │
│  │  - What went well                                  │  │
│  │  - What could be improved                          │  │
│  │  - Action items with owners                        │  │
│  │  Format as structured markdown.                    │  │
│  │                                                    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  Character count: 234                                     │
│                                                           │
│  ┌──────────────┐          ┌──────────────────────────┐  │
│  │    Preview   │          │        Save Template      │  │
│  └──────────────┘          └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Prompt textarea: mono font, min 200px height, resizable, syntax highlight placeholder text
- Character count shown below
- Preview button: runs template on last selected recording (non-destructive)

---

### 4.10 Settings Screen

**Route:** `/settings`  
**Layout:** App shell, settings sidebar sub-navigation

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ > Account       │  │  Transcription                │  │
│  │   Appearance    │  │                              │  │
│  │   Audio         │  │  Mode                        │  │
│  │   Transcription │  │  ┌──────────────────────┐    │  │
│  │   LLM / AI      │  │  │ ● Local (Whisper)   │    │  │
│  │   Templates     │  │  │ ○ Server (faster-    │    │  │
│  │   About         │  │  │   whisper)           │    │  │
│  └─────────────────┘  │  └──────────────────────┘    │  │
│                        │                              │  │
│                        │  Whisper Model (local)       │  │
│                        │  ┌──────────────────────┐    │  │
│                        │  │  base (74 MB)     ▾  │    │  │
│                        │  └──────────────────────┘    │  │
│                        │  [ℹ Model cached ✓]          │  │
│                        │                              │  │
│                        │  Backend Server URL          │  │
│                        │  ┌──────────────────────┐    │  │
│                        │  │  http://localhost:8000│    │  │
│                        │  └──────────────────────┘    │  │
│                        │                              │  │
│                        │  [  Save Settings  ]         │  │
│                        │                              │  │
│                        └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Settings sections:**
- **Account:** Name, email, change password, delete account
- **Appearance:** Light/Dark/System theme, font size, sidebar width
- **Audio:** Default mic device dropdown, system audio toggle, audio quality (16kHz/44.1kHz), recording format
- **Transcription:** Mode selector (Local/Server), Whisper model size (local mode), model download status, backend URL
- **LLM / AI:** Provider, API key, model selector, Whisper model size (server mode), backend URL, test connection button
- **Templates:** Quick link to templates page
- **About:** Version, check for updates, licenses

---

### 4.11 Pipeline Architecture & Processing States

**Core principle: Every step is standalone, repeatable, and produces a viewable artifact.**

**Processing states in the Document Viewer:**
- Recording item shows pulsing orange dot + "Processing..." text
- Click opens document viewer with progress bar
- Each step (transcription → diarization → naming → output) is shown separately
- Failed steps show error with "Retry" button (re-runs only that step)
- Completed steps show checkmark and are viewable immediately
- User can click any completed step to view its output

**Pipeline status bar (in document viewer):**
```
  ● Transcribed ──── ⟳ Diarizing ──── ○ Naming ──── ○ Output
  ████████████████████░░░░░░░░░░░░  54%  ~2 min remaining
```

**Step-level actions:**
- Hovering a completed step shows: View | Re-run | Download
- "Re-run" re-executes just that step with the same or different parameters
- "Download" saves the step's output artifact (JSON or markdown)

**Error handling:**
- Failed step shows red X with error message
- "Retry" button re-runs ONLY the failed step
- Previous steps' outputs are preserved and viewable
- Next steps are blocked until the failed step succeeds

**Skeleton loading states:**
- Tab content: 3–4 lines of animated shimmer rectangles
- Recording list items: shimmer name + date lines

**Toasts (notifications, top-right):**
- Success: green left border, checkmark icon
- Error: red left border, X icon
- Info: blue left border, info icon
- Auto-dismiss: 4 seconds
- Max 3 visible, stack downward

---

## 5. Component Library

### 5.1 Buttons

| Variant | Description |
|---------|-------------|
| `primary` | Accent fill, white text |
| `secondary` | Border, no fill, primary text |
| `ghost` | No border, no fill, subtle hover |
| `destructive` | Destructive fill, white text |
| `icon` | Square, icon only |

Sizes: `sm` (28px), `md` (36px, default), `lg` (44px)  
States: default, hover, active, disabled, loading (spinner replaces label)

### 5.2 Inputs

- Default border, focus ring: 2px accent color
- Error state: destructive border, error message below
- Disabled: muted background, muted text
- Prefix/suffix icons supported

### 5.3 Dropdowns / Selects

- Trigger: looks like an input with chevron-down icon
- Dropdown: surface, shadow-lg, 8px border radius
- Item height: 36px
- Selected: accent-subtle background, checkmark right
- Search input at top if > 8 items

### 5.4 Badges

```
● Active    (green dot + text)
⟳ Processing (amber + spinner)
✕ Failed     (red)
```

Pill shape, caption size, colored background + text

### 5.5 Progress Bar

- Background: surface-raised
- Fill: accent color gradient (accent → accent-hover)
- Height: 4px (thin) or 8px (thick)
- Animated shimmer when indeterminate

### 5.6 Tabs

- Underline style: 2px accent bottom border on active
- Inactive: muted text, no border
- Hover: primary text
- Number badge on tab if content has notifications

---

## 6. Interaction Patterns

### 6.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New recording |
| `Ctrl+U` | Upload audio |
| `Ctrl+F` | Find in document |
| `Space` | Pause/resume recording |
| `Ctrl+Enter` | Send chat message |
| `Escape` | Close modal/dialog |
| `Ctrl+,` | Open settings |

### 6.2 Drag & Drop

- Drag audio files onto the app window (anywhere) → triggers upload flow
- Drop highlight: full-window overlay with dashed border, accent color

### 6.3 Responsive Behavior

- Sidebar collapse: auto-collapse at window width < 900px
- Chat panel: auto-hide at width < 1100px, becomes a floating button
- Min window size: 800 × 600px

---

## 7. Iconography

Use **Lucide Icons** throughout. Key icons:

| Element | Icon |
|---------|------|
| New Recording | `Mic` |
| Upload | `Upload` |
| Play audio | `Play` |
| Stop recording | `Square` |
| Pause | `Pause` |
| Settings | `Settings` |
| Templates | `FileText` |
| Chat | `MessageSquare` |
| Speakers | `Users` |
| Export | `Download` |
| Copy | `Copy` |
| Delete | `Trash2` |
| Edit | `Pencil` |
| Success | `CheckCircle2` |
| Error | `XCircle` |
| Warning | `AlertCircle` |
| Processing | `Loader2` (animated spin) |
| Raw transcript | `AlignLeft` |
| Diarized | `Users` |
| Named | `UserCheck` |
| Output | `Sparkles` |

---

## 8. Accessibility

- All interactive elements: minimum 44px touch target
- Color alone never conveys state (always pair with icon/text)
- Focus indicators: 2px accent outline, 2px offset
- ARIA labels on icon-only buttons
- Keyboard navigable sidebar and tabs
- Reduced motion: disable all animations when `prefers-reduced-motion: reduce`

---

## 9. Empty & Error States

### Empty transcript
> Icon: `FileSearch` (48px, muted)  
> Title: "No content yet"  
> Body: "This stage hasn't been processed yet."  
> Action: none (or "Process Now" if applicable)

### Processing failed
> Icon: `AlertCircle` (48px, destructive)  
> Title: "Processing failed"  
> Body: brief error message  
> Action: "Retry" button

### No recordings
> Icon: `Mic` (64px, muted)  
> Title: "No recordings yet"  
> Body: "Record a meeting or upload an audio file to get started."  
> Actions: "Start Recording" + "Upload File"
