# Disk-Based Rewind Feature Specification

## Problem

The current `useTimeMachine` hook stores video frames as `ImageBitmap` objects in memory. At 20 FPS with 30 seconds buffer, this consumes ~700MB-1.2GB RAM, which crashes mobile devices and strains desktop browsers.

## Solution

Replace in-memory frame storage with disk-based video chunks using:
- **MediaRecorder API** - Record video stream as compressed WebM chunks
- **IndexedDB** - Store chunks on disk (browser-managed)
- **First-frame previews** - Extract JPEG thumbnail from each chunk for scrubber UI

## Architecture

```
Video Stream → MediaRecorder (5s chunks) → IndexedDB
                     ↓
              First frame extracted as JPEG preview
                     ↓
              Scrubber shows preview thumbnails
                     ↓
              Playback via <video> element (not canvas)
```

## Memory & Quality Improvement

| Mode | 60 seconds buffer | RAM Usage | Resolution |
|------|------------------|-----------|------------|
| Current (memory) | 1200 frames @ ImageBitmap | ~1GB | 35-50% downscaled |
| Disk-based | 12 chunks @ ~2MB each | ~5-15MB | **Full resolution** |

### Why Full Resolution Works

Memory mode stores raw RGBA pixels - must downsample to fit in RAM:
```typescript
quality: isHQ ? 0.5 : 0.35  // 35-50% of original size
```

Disk mode uses MediaRecorder with hardware-accelerated video compression (VP9/VP8):
- 1080p @ 5 seconds ≈ 1-3MB per chunk (vs ~600MB raw)
- Full resolution preserved
- Better visual quality than downsampled raw frames

## Files Created (Partial Implementation)

### 1. `src/services/DiskBufferService.ts` ✅ COMPLETE
IndexedDB wrapper with:
- `saveChunk(blob, preview, timestamp, duration)` - Store video chunk + preview
- `getAllChunks()` - Retrieve all chunks
- `getPreviewFrames()` - Get thumbnails for scrubber
- `pruneOldChunks(keepCount)` - Circular buffer cleanup
- `exportVideo()` - Concatenate chunks for download
- `clearAll()` - Clear buffer

### 2. `src/hooks/useDiskTimeMachine.ts` ✅ COMPLETE
Hook that:
- Uses MediaRecorder to capture 5-second video chunks
- Extracts first frame as JPEG preview via temporary `<video>` + canvas
- Stores chunks in IndexedDB via DiskBufferService
- Exposes: `enterReplay`, `exitReplay`, `play`, `pause`, `seek`, `seekToChunk`, `saveVideo`, `previews`, `videoSrc`

### 3. `src/components/CameraStage.tsx` 🔄 PARTIAL
Started integration:
- Added `useDiskRewind` state (persisted to localStorage, defaults to `true`)
- Added `streamRef` to pass MediaStream to disk hook
- Added `replayVideoRef` for disk-mode playback
- Added unified `timeMachine` interface that switches between memory/disk modes
- Added `<video>` element for disk replay (alongside existing canvas for memory mode)

## Remaining Work

### CameraStage.tsx Integration
1. **Add save button** to replay controls (use `Download` icon from lucide-react, already imported)
2. **Update filmstrip** to use `imageUrl` from previews instead of `ImageBitmap` when in disk mode
3. **Add disk mode toggle** in settings or main controls (use `useDiskRewind` / `setUseDiskRewind`)
4. **Update status bar** to show "Disk" indicator and chunk count instead of RAM usage when in disk mode

### Thumbnail Component Update
The `Thumbnail` component (`src/components/Thumbnail.tsx`) currently expects `ImageBitmap`. Needs to also accept `imageUrl: string` for disk mode previews.

### Testing
1. Verify MediaRecorder works across browsers (Chrome, Firefox, Safari)
2. Test chunk boundary playback (seamless transitions)
3. Verify IndexedDB storage/retrieval
4. Test save/download functionality
5. Measure actual memory usage reduction

## Key Implementation Details

### Chunk Duration: 5 seconds
- Balances seek granularity vs overhead
- 12 chunks = 60 seconds total buffer

### Preview Capture
```typescript
// In useDiskTimeMachine.ts - captureFirstFrame()
// Creates temp video, seeks to 0, draws to canvas, exports as JPEG
```

### Unified Interface
The `timeMachine` object in CameraStage switches between memory and disk implementations transparently. Most UI code doesn't need to know which mode is active.

### Video Playback
Disk mode uses a `<video>` element with `src` set to blob URL, vs memory mode which draws `ImageBitmap` to canvas.

## API Reference

### DiskTimeMachineControls
```typescript
interface DiskTimeMachineControls {
  isReplaying: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;        // ms
  totalDuration: number;      // ms
  chunkCount: number;
  previews: ChunkPreview[];   // { id, timestamp, imageUrl }
  videoSrc: string | null;    // Current chunk blob URL
  enterReplay: () => void;
  exitReplay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  seekToChunk: (chunkId: number) => void;
  saveVideo: () => Promise<void>;
  clearBuffer: () => Promise<void>;
}
```

## Notes for Implementation Agent

1. The `Download` icon is already imported in CameraStage.tsx
2. `setUseDiskRewind` callback is already created
3. The unified `timeMachine` interface already has `saveVideo`, `chunkCount`, `isRecording`, `previews`
4. Focus on UI integration - the core recording/storage logic is complete
5. Run `just dev` to test, `just test` for unit tests
