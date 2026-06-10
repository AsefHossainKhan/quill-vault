# QuillVault — AI Transcription & Analysis Desktop App

## 1. Project Overview
**QuillVault** is a modern Windows desktop application (Electron/Vite/TypeScript) designed for recording, transcribing, and analyzing meetings. It features a sophisticated dual-channel recording system, an AI-powered processing pipeline, and a structured document viewer with integrated AI chat.

## 2. Technical Stack
- **Framework**: Electron + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Typography**: Inter (Primary), JetBrains Mono (Transcripts)

## 3. Design System (Tokens)

### Light Mode
- **Background**: `#FAFAFA`
- **Surface**: `#FFFFFF`
- **Raised Surface**: `#F4F4F5`
- **Border**: `#E4E4E7`
- **Primary Text**: `#09090B`
- **Secondary Text**: `#71717A`
- **Accent (Indigo)**: `#6366F1`
- **Accent Hover**: `#4F46E5`
- **Accent Subtle**: `#EEF2FF`
- **Destructive**: `#EF4444`
- **Success**: `#22C55E`
- **Warning**: `#F59E0B`

### Dark Mode
- **Background**: `#09090B`
- **Surface**: `#18181B`
- **Raised Surface**: `#27272A`
- **Border**: `#3F3F46`
- **Primary Text**: `#FAFAFA`
- **Secondary Text**: `#A1A1AA`
- **Accent**: `#818CF8`
- **Accent Hover**: `#6366F1`
- **Accent Subtle**: `#1E1B4B`

### Visual Standards
- **Radius**: `md: 8px`, `lg: 12px`, `xl: 16px`
- **Base Grid**: 8px
- **Shadows**: Clean, soft shadows (`0 4px 6px rgba(0,0,0,0.07)`)

## 4. Key Screens & UI Architecture

### 4.1 Shell Layout
- **Custom Titlebar**: 32px height, drag region, app logo + name on left, window controls on right.
- **Side Navigation**: 240px fixed width, collapsible. Contains "New Recording" CTA and "Library" list.
- **Main Content**: Dynamic area for Dashboard, Recording, or Document Viewer.

### 4.2 Dashboard (Home)
- **Empty State**: Centralized "No recording selected" graphic with a large mic icon.
- **Actions**: "Start Recording" (Primary) and "Upload File" (Secondary) buttons.
- **Sidebar**: List of recent recordings with timestamps and duration metadata.

### 4.3 Recording Interface (Modal)
- **Visualizer**: Dual-channel real-time waveform (Mic: Indigo, System: Emerald).
- **Status Cards**: Individual status for Microphone and System Audio with level meters.
- **Controls**: Pause, Stop & Save, Discard.

### 4.4 Document Viewer (Meeting Review)
- **Header**: Recording title, date, duration, and action menus.
- **Pipeline Progress**: Visual stepper: `Transcribed` → `Diarized` → `Named` → `Output`.
- **Tabs**:
  1. **Raw Transcript**: Pure text.
  2. **Named Transcript**: Color-coded speaker blocks with inline editing.
  3. **Summary/Output**: Rendered Markdown view.
- **Chat Panel**: 320px right-hand panel for conversing with the transcript.

### 4.5 Login / Auth
- **Layout**: Centered 400px card.
- **Features**: Email/Password fields with show/hide toggle, "Forgot Password" link, and "Sign In" CTA.

## 5. Assets
- **Logo**: Sleek quill/fountain pen tip combined with a shield/vault shape. Color: Indigo/Slate Gray.
