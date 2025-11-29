# Disk-Based Rewind Feature Specification

## Problem

Current rewind stores raw frames in memory: ~1GB RAM for 60 seconds, crashes mobile devices, requires downscaling to 35-50% resolution.

## Solution

Record compressed video chunks to IndexedDB instead of raw frames in memory.

## Benefits

| | Memory Mode | Disk Mode |
|--|-------------|-----------|
| RAM | ~1GB | ~15MB |
| Resolution | 35-50% downscaled | **Full resolution** |
| Mobile | Crashes | Works |

## Architecture

```
Video Stream → MediaRecorder (5s chunks) → IndexedDB
                     ↓
              First frame as JPEG preview (for scrubber)
                     ↓
              Playback via <video> element
```

## Implementation Status

### Done
- `DiskBufferService.ts` - IndexedDB wrapper for chunk storage
- `useDiskTimeMachine.ts` - MediaRecorder hook with preview extraction
- `CameraStage.tsx` - Hooks wired up, unified interface created

### Remaining
1. Add save/download button to replay controls
2. Update Thumbnail component to accept `imageUrl` (not just ImageBitmap)
3. Update filmstrip to show chunk previews in disk mode
4. Add disk/memory mode toggle in UI
5. Update status bar to show chunk count instead of RAM in disk mode

## Key Decisions

- **5 second chunks** - Balance between seek granularity and overhead
- **12 chunks max** - 60 seconds total buffer
- **First-frame previews** - One JPEG per chunk for scrubber thumbnails
- **WebM format** - Native MediaRecorder output, no transcoding needed
