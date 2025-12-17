# Architecture: Practice Session Recorder

## Concept Evolution

Original PRD: "Instant replay with 60s buffer"
New concept: **Practice journal** - always recording, save the good stuff, review later

## User Mental Model

```
┌──────────────────────────────────────────────────────────┐
│                    SESSION PICKER                        │
│                                                          │
│  RECENT (auto-rolling)                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ ▶ 2:30  │ │   5:00  │ │   5:00  │                    │
│  │ (live)  │ │ 5m ago  │ │ 10m ago │  ← rolls off       │
│  └─────────┘ └─────────┘ └─────────┘                    │
│                                                          │
│  SAVED                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ ⭐      │ │         │ │         │                    │
│  │ "5-ball"│ │"mills"  │ │"Mar 10" │                    │
│  └─────────┘ └─────────┘ └─────────┘                    │
└──────────────────────────────────────────────────────────┘
```

## App States

Recording only happens in LIVE state. Picker and Replay = paused (no recording).

```
┌─────────────┐  tap "Sessions"   ┌─────────────┐
│    LIVE     │ ────────────────► │   PICKER    │
│ (recording) │                   │  (paused)   │
└─────────────┘                   └─────────────┘
       ▲                                 │
       │                           tap a session
       │                                 │
       │   exit replay                   ▼
       │                          ┌─────────────┐
       └───────────────────────── │   REPLAY    │
                                  │  (paused)   │
                                  └─────────────┘

       Any state can transition to ERROR on failure:

┌─────────────┐
│    ERROR    │  ← MediaRecorder crash, storage full, etc.
│  (paused)   │  → Shows error message + recovery action
└─────────────┘
```

**Reviewing in-progress block:** Tapping the current recording stops it,
finalizes it as a completed block, then shows it in Replay. When exiting
replay, a fresh recording block starts.

### State Type Definition

```typescript
type AppState = 'live' | 'picker' | 'replay' | 'error'

interface AppStateContext {
  state: AppState
  isRecording: boolean        // true only in 'live'
  currentSession: string | null  // session ID when in 'replay'
  error: {
    message: string
    recoveryAction: () => void
  } | null
}

// State invariants (tested):
// - isRecording === true  ⟺  state === 'live'
// - currentSession !== null  ⟺  state === 'replay'
// - error !== null  ⟺  state === 'error'
```

## User Flows

### Flow 1: Practice → Quick Review
```
[Live Camera] → tap "Sessions" → [Picker] → tap recent block → [Replay]
                                                    │
                                            scrub/frame-step
                                                    │
                                            tap "Back" → [Live Camera]
```

### Flow 2: Save a Moment
```
[Replay] → find the moment → set In/Out → tap "Save Clip"
                                              │
                                        [Name Dialog]
                                              │
                                        → Saved to library
```

### Flow 3: Export/Share
```
[Picker] → tap saved session → [Replay] → tap "Share"
                                              │
                                        [Native Share Sheet]
                                        or Download
```

## Data Model

```typescript
interface PracticeSession {
  id: string                    // uuid
  createdAt: number             // timestamp ms
  duration: number              // seconds

  // Storage
  blobKey: string               // IndexedDB key for video blob
  thumbnail: string             // JPEG data URL (first frame, for list view)
  thumbnails: SessionThumbnail[] // every 15s, for timeline view

  // State
  saved: boolean                // false = auto-prune eligible
  name?: string                 // user-provided name (saved only)

  // Trim (optional - for saved clips)
  trimIn?: number               // start time in seconds
  trimOut?: number              // end time in seconds
}

interface SessionThumbnail {
  time: number                  // seconds into video
  dataUrl: string               // JPEG data URL
}
```

A 5-min block has ~100 thumbnails (every 3s). Each JPEG ~10-30KB = ~1-3MB per block.

## Storage Architecture

### IndexedDB Schema

```
Database: "magic-monitor-sessions"

Object Store: "sessions"
  - keyPath: "id"
  - indexes: ["createdAt", "saved"]

Object Store: "blobs"
  - keyPath: "id"
  - (stores raw video Blobs separately for efficient pruning)
```

### SessionStorageService.ts (Full CRUD)

```typescript
export const SessionStorageService = {
  // Initialize database
  async init(): Promise<void>,

  // Create
  async saveSession(session: Omit<PracticeSession, 'id'>): Promise<string>,
  async saveSessionWithBlob(session: Omit<PracticeSession, 'id'>, blob: Blob): Promise<string>,  // atomic
  async saveBlob(id: string, blob: Blob): Promise<void>,

  // Read
  async getSession(id: string): Promise<PracticeSession | null>,
  async getBlob(id: string): Promise<Blob | null>,
  async getRecentSessions(limit?: number): Promise<PracticeSession[]>,
  async getSavedSessions(): Promise<PracticeSession[]>,
  async getAllSessions(): Promise<PracticeSession[]>,

  // Update
  async updateSession(id: string, updates: Partial<PracticeSession>): Promise<void>,
  async markAsSaved(id: string, name: string): Promise<void>,
  async setTrimPoints(id: string, trimIn: number, trimOut: number): Promise<void>,

  // Delete
  async deleteSession(id: string): Promise<void>,
  async deleteBlob(id: string): Promise<void>,
  async deleteSessionWithBlob(id: string): Promise<void>,  // atomic

  // Pruning
  async pruneOldSessions(keepDurationSeconds?: number): Promise<number>,  // returns count deleted
  async getStorageUsage(): Promise<{ used: number, quota: number }>,

  // Cleanup
  async clear(): Promise<void>,  // clear all data
  close(): void
}

export type SessionStorageServiceType = typeof SessionStorageService
```

### Storage Limits

| Type | Policy | Est. Size (5Mbps) |
|------|--------|-------------------|
| Recent unsaved | Keep ~10 min worth | ~375 MB max |
| Saved sessions | User manages | Unlimited (warn at 3GB) |

### Pruning Logic

Actual implementation in `SessionStorageService.pruneOldSessions()`:

```typescript
const keepDurationSeconds = SESSION_CONFIG.MAX_RECENT_DURATION_SECONDS  // 10 minutes

async function pruneOldSessions(keepDurationSeconds: number) {
  const unsaved = await getRecentSessions(1000)  // Get all unsaved, sorted newest first

  let totalDurationSeconds = 0
  const toKeep: string[] = []
  const toDelete: string[] = []

  for (const session of unsaved) {
    if (totalDurationSeconds < keepDurationSeconds) {
      toKeep.push(session.id)
      totalDurationSeconds += session.duration  // duration is in seconds
    } else {
      toDelete.push(session.id)
    }
  }

  // Delete old sessions and their blobs atomically
  await Promise.all(toDelete.map(id => deleteSessionWithBlob(id)))
  return toDelete.length
}
```

## Recording Architecture

### Block-Based Recording

```
            5 min                5 min
         ◄────────►          ◄────────►
┌────────────────────┬────────────────────┬─────────...
│     Block A        │      Block B       │   Block C (in progress)
└────────────────────┴────────────────────┴─────────...
        │                    │
        ▼                    ▼
   [IndexedDB]          [IndexedDB]

On block complete:
  1. Stop MediaRecorder
  2. Run fix-webm-meta for seekable video
  3. Extract thumbnail (first frame)
  4. Save to IndexedDB
  5. Prune old unsaved blocks
  6. Start new MediaRecorder
```

### Recording Service

```typescript
interface RecordingService {
  // State
  isRecording: boolean
  currentBlockStart: Date
  currentDuration: number       // seconds into current block
  currentThumbnails: SessionThumbnail[]  // grows every 15s

  // Controls
  start(): void
  stop(): Promise<PracticeSession>  // returns current block

  // Events
  onBlockComplete: (session: PracticeSession) => void
}
```

### Realtime Thumbnail Capture

```typescript
const THUMBNAIL_INTERVAL_MS = 3_000  // every 3 seconds (configurable via SESSION_CONFIG)

// Inside recording loop
useEffect(() => {
  if (!isRecording) return

  const interval = setInterval(() => {
    const video = videoRef.current
    if (!video) return

    // Grab frame from live video
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    const time = (Date.now() - blockStartTime) / 1000

    setCurrentThumbnails(prev => [...prev, { time, dataUrl }])
  }, THUMBNAIL_INTERVAL_MS)

  return () => clearInterval(interval)
}, [isRecording])
```

Thumbnails accumulate during recording. When block completes, they're saved with the session.

### Configuration

From `src/types/sessions.ts`:

```typescript
export const SESSION_CONFIG = {
  BLOCK_DURATION_MS: 5 * 60 * 1000,           // 5 minutes
  MAX_RECENT_DURATION_SECONDS: 10 * 60,       // 10 minutes of history
  VIDEO_BITRATE: 5_000_000,                   // 5 Mbps - balanced quality/performance
  THUMBNAIL_QUALITY: 0.7,                     // JPEG quality
  THUMBNAIL_INTERVAL_MS: 3_000,               // every 3 seconds (for fine-grained selection)
  STORAGE_WARNING_BYTES: 3 * 1024 * 1024 * 1024, // 3 GB
}
```

## Replay Architecture

### Playback Requirements (from PRD)

- [x] Thumbnail filmstrip → Session picker with thumbnails
- [ ] Timeline scrubber → Native video seeking (post fix-webm-meta)
- [ ] Frame stepping → requestVideoFrameCallback
- [ ] Mark In/Out → Time values on session
- [ ] Trim preview → video.currentTime clamping
- [ ] Export trimmed → Blob.slice or re-encode

### ReplayPlayer Hook

```typescript
interface ReplayPlayer {
  // State
  session: PracticeSession | null
  isPlaying: boolean
  currentTime: number
  duration: number

  // Trim state
  inPoint: number | null
  outPoint: number | null

  // Navigation
  play(): void
  pause(): void
  seek(time: number): void
  stepFrame(direction: 1 | -1): void

  // Trimming
  setInPoint(): void       // mark current time as In
  setOutPoint(): void      // mark current time as Out
  clearTrim(): void
  previewTrim(): void      // play only In→Out range

  // Save/Export
  saveClip(name: string): Promise<PracticeSession>
  exportVideo(): Promise<void>   // share sheet or download

  // Video element ref (for rendering)
  videoRef: RefObject<HTMLVideoElement>
}
```

### Frame Stepping Implementation

```typescript
function useFrameStepper(videoRef: RefObject<HTMLVideoElement>) {
  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current
    if (!video) return

    // Approximate frame duration (assume 30fps)
    const frameDuration = 1 / 30
    video.currentTime = Math.max(0,
      Math.min(video.duration, video.currentTime + direction * frameDuration)
    )
  }, [])

  return { stepFrame }
}
```

## UI Components

### SessionPicker (Two-Level Navigation)

**Level 1: Session List** - One thumbnail per block, tap to drill down

```
┌─────────────────────────────────────────────────────┐
│  Sessions                                      ✕    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Recent                                             │
│  ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ thumb │ │ thumb │ │ thumb │                     │
│  │ 2:30  │ │ 5:00  │ │ 5:00  │                     │
│  │ ● REC │ │ 5m    │ │ 10m   │                     │
│  └───────┘ └───────┘ └───────┘                     │
│       │                                             │
│       ▼ tap                                         │
│                                                     │
│  Saved                                              │
│  ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ thumb │ │ thumb │ │ thumb │                     │
│  │ ⭐    │ │       │ │       │                     │
│  │"5-bal"│ │"mills"│ │"Mar10"│                     │
│  └───────┘ └───────┘ └───────┘                     │
│                                                     │
│  Storage: 1.2 GB used                    [Clear...] │
└─────────────────────────────────────────────────────┘
```

**Level 2: Block Timeline** - Thumbnails every 15s, tap to seek into replay

```
┌─────────────────────────────────────────────────────┐
│  ◄ Back                              5:00 block     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │ │
│  │0:00│ │0:15│ │0:30│ │0:45│ │1:00│ │1:15│ │1:30│ │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ │
│                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ...           │
│  │    │ │    │ │    │ │    │ │    │               │
│  │1:45│ │2:00│ │2:15│ │2:30│ │2:45│               │
│  └────┘ └────┘ └────┘ └────┘ └────┘               │
│                                                     │
│         tap thumbnail → open replay seeked there   │
│                                                     │
│  [Play from start]                         [Save]   │
└─────────────────────────────────────────────────────┘
```

5-min block = ~100 thumbnails at 3s intervals (displayed count varies based on screen size).

### ReplayControls

```
┌─────────────────────────────────────────────────────┐
│  ✕  │  ◀◀  ◀  ▶  ▶▶  │  ━━━●━━━━━━━━  │  1:23/5:00 │
├─────────────────────────────────────────────────────┤
│  [In]  [Out]  │  ━━━━[████]━━━━━  │  [Preview]     │
├─────────────────────────────────────────────────────┤
│  [Save Clip]                              [Share]   │
└─────────────────────────────────────────────────────┘
```

## Component Tree

```
CameraStage
├── LiveVideo (when not in session picker/replay)
├── SessionPicker (modal)
│   ├── RecentSessions
│   │   └── SessionThumbnail (× N)
│   ├── SavedSessions
│   │   └── SessionThumbnail (× N)
│   └── StorageIndicator
└── ReplayView (when viewing session)
    ├── ReplayVideo
    ├── ReplayControls
    │   ├── PlaybackControls
    │   ├── Timeline (with trim handles)
    │   └── ActionButtons (Save, Share)
    └── TrimPreview
```

## File Structure

```
src/
├── hooks/
│   ├── useSessionRecorder.ts    # Block-based recording orchestration
│   ├── useSessionList.ts        # Session list management + saveBlock
│   ├── useBlockRecorder.ts      # Individual block recording
│   ├── useBlockRotation.ts      # Auto-rotate through recording blocks
│   ├── useReplayPlayer.ts       # Playback + trim controls + frame stepping
│   └── useThumbnailCapture.ts   # Thumbnail extraction during recording
├── services/
│   ├── SessionStorageService.ts # IndexedDB abstraction
│   ├── VideoFixService.ts       # fix-webm-meta wrapper (Humble Object)
│   ├── ThumbnailCaptureService.ts # Canvas operations (Humble Object)
│   ├── MediaRecorderService.ts  # MediaRecorder wrapper (Humble Object)
│   ├── ShareService.ts          # Native share / download (Humble Object)
│   └── TimerService.ts          # Injectable timers (Humble Object)
├── components/
│   ├── SessionPicker.tsx        # Thumbnail grid modal
│   ├── SessionThumbnail.tsx     # Individual preview card
│   ├── ReplayView.tsx           # Full replay experience
│   ├── ReplayControls.tsx       # Transport + trim UI
│   ├── Timeline.tsx             # Scrubber with trim handles
│   └── ThumbnailGrid.tsx        # Grid layout for session thumbnails
├── machines/
│   └── SessionRecorderMachine.ts # XState machine for recording state
└── types/
    └── sessions.ts              # PracticeSession, etc.
```

## Humble Object Services (for Testability)

Following the existing pattern in CameraService.ts and DeviceService.ts, all browser APIs
are wrapped in injectable services.

### VideoFixService.ts

```typescript
export const VideoFixService = {
  /**
   * Fix WebM metadata for seeking support.
   * Wraps fix-webm-meta or similar library.
   */
  async fixDuration(blob: Blob): Promise<Blob> {
    // Import and call fix-webm-meta
    const { fixWebmDuration } = await import('fix-webm-duration')
    return fixWebmDuration(blob)
  },

  /**
   * Check if fix is needed (Safari 18.4+ may not need it).
   */
  needsFix(): boolean {
    // Detection logic for browser support
    return true
  }
}

export type VideoFixServiceType = typeof VideoFixService
```

### ThumbnailCaptureService.ts

```typescript
export const ThumbnailCaptureService = {
  /**
   * Capture a frame from video element as JPEG data URL.
   */
  captureFromVideo(
    video: HTMLVideoElement,
    quality: number = 0.7
  ): string {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get canvas context')
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', quality)
  },

  /**
   * Capture frame at specific time from video blob.
   */
  async captureAtTime(blob: Blob, timeSeconds: number, quality: number = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      const url = URL.createObjectURL(blob)
      video.src = url

      video.onloadedmetadata = () => {
        video.currentTime = timeSeconds
      }

      video.onseeked = () => {
        try {
          const dataUrl = this.captureFromVideo(video, quality)
          URL.revokeObjectURL(url)
          resolve(dataUrl)
        } catch (err) {
          URL.revokeObjectURL(url)
          reject(err)
        }
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load video'))
      }

      video.load()
    })
  }
}

export type ThumbnailCaptureServiceType = typeof ThumbnailCaptureService
```

### ShareService.ts

```typescript
export const ShareService = {
  /**
   * Check if native sharing is available.
   */
  canShare(): boolean {
    return 'share' in navigator && 'canShare' in navigator
  },

  /**
   * Share video file via native share sheet.
   * Returns true if shared, false if user cancelled.
   */
  async share(blob: Blob, filename: string): Promise<boolean> {
    if (!this.canShare()) {
      this.download(blob, filename)
      return false
    }

    const file = new File([blob], filename, { type: blob.type })

    if (!navigator.canShare({ files: [file] })) {
      this.download(blob, filename)
      return false
    }

    try {
      await navigator.share({
        files: [file],
        title: filename
      })
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return false  // User cancelled
      }
      throw err
    }
  },

  /**
   * Fallback: download file directly.
   */
  download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export type ShareServiceType = typeof ShareService
```

### TimerService.ts

```typescript
export const TimerService = {
  /**
   * Set interval (wraps window.setInterval for testability).
   */
  setInterval(callback: () => void, ms: number): number {
    return window.setInterval(callback, ms)
  },

  /**
   * Clear interval.
   */
  clearInterval(id: number): void {
    window.clearInterval(id)
  },

  /**
   * Get current timestamp.
   */
  now(): number {
    return Date.now()
  }
}

export type TimerServiceType = typeof TimerService
```

## Migration from Current Code

### Keep
- `CameraStage.tsx` - main orchestrator (modify)
- `useCamera.ts` - camera access (unchanged)
- `useSmartZoom.ts` - AI zoom (unchanged)
- `MediaRecorderService.ts` - recording primitives (extend)
- `Thumbnail.tsx` - reuse for session previews

### Replace
- `useDiskTimeMachine.ts` → `useSessionRecorder.ts` + `useReplayPlayer.ts`
- `DiskBufferService.ts` → `SessionStorageService.ts`

### Add
- `fix-webm-meta` npm package
- `SessionPicker.tsx` + related components
- Share API integration

## Dependencies

```json
{
  "fix-webm-meta": "^1.0.0"  // or similar, for seekable WebM
}
```

## Critical Test Cases

Following TDD - these tests should be written BEFORE implementation.

### P0: Must-Have Before Implementation

```typescript
// State Machine
describe('AppState transitions', () => {
  it('LIVE → PICKER stops recording')
  it('PICKER → REPLAY loads session')
  it('REPLAY → LIVE resumes recording')
  it('tapping in-progress block finalizes it first')
  it('any state → ERROR on failure')
  it('ERROR → LIVE on recovery')
  it('invariant: isRecording === true only in LIVE state')
})

// Block Lifecycle
describe('useSessionRecorder', () => {
  it('creates new block every 5 minutes')
  it('captures thumbnail every 15 seconds during recording')
  it('saves block with thumbnails on completion')
  it('prunes to keep only 10 minutes of unsaved blocks')
  it('handles MediaRecorder error mid-block')
  it('handles storage quota exceeded')
})

// Storage
describe('SessionStorageService', () => {
  it('saves and retrieves session with blob')
  it('prunes oldest unsaved when over 10 min')
  it('never prunes saved sessions')
  it('reports accurate storage usage')
})
```

### P1: Must-Have Before Launch

```typescript
// Replay
describe('useReplayPlayer', () => {
  it('seeks to any time in video')
  it('steps forward/backward by one frame')
  it('sets and clears in/out trim points')
  it('plays only trim range in preview mode')
})

// Export
describe('ShareService', () => {
  it('shares via native share sheet when available')
  it('falls back to download when share unavailable')
  it('exports only trimmed portion')
})

// Edge Cases
describe('Edge cases', () => {
  it('handles tab backgrounding (stops/resumes recording)')
  it('handles camera disconnect mid-recording')
  it('validates trim points within video duration')
  it('handles concurrent rapid state transitions')
})
```

## Decisions Made

1. **Trim storage** - Store trim points, slice on export (saves storage)

2. **Live block access** - Yes, tapping in-progress block stops it, finalizes it, shows in replay. Recording paused while reviewing.

3. **Cross-session continuity** - Yes, IndexedDB persists across browser sessions

4. **Retention policy** - Keep ~10 minutes of recent (unsaved) blocks, prune oldest when exceeded

5. **Storage warning** - Warn user at 3 GB total

6. **Thumbnail generation** - Realtime during recording (every 15s), not batch on complete. Thumbnails ready instantly when tapping a block.

## Open Questions

1. **Block duration** - 5 minutes feels right, but should it be configurable?
