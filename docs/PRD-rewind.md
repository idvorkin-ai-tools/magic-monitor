# PRD: Rewind Feature

## Overview

A replay system that lets users **capture highlight clips** and **review their practice** with precision and ease.

## User Jobs

### Job 1: Save a Highlight Clip

> "Something cool just happened - I want to grab that moment and share it"

**Scenarios:**
- I'm juggling, I nail a trick, I want to save the last 10 seconds
- The moment was 3 seconds but I have 60 seconds of buffer - I only want the good part
- The trick started mid-way through, I need precision to set my clip boundaries
- I want to share this immediately via Messages / AirDrop / social media

### Job 2: Review My Practice

> "I'm practicing a skill and want to see what I'm actually doing vs what I think I'm doing"

**Scenarios:**
- I want to see my hand position at the exact moment of release
- Show me frame-by-frame what happened during that failed catch
- Let me step through slowly to understand the timing

## User Flow

```
[Live Camera]
      │
      ▼  tap "Rewind"
[Replay Mode]
      │
      ├─► Scan thumbnails → tap one near the moment
      ├─► Drag timeline scrubber → get closer
      ├─► Frame-step ◀ ▶ → find exact frame
      ├─► Tap "In" to mark start
      ├─► Navigate to end point
      ├─► Tap "Out" to mark end
      │
      ▼  tap "Share"
[Native Share Sheet]
      │
      └─► Messages / AirDrop / Save to Photos / etc.
```

## Features

### Navigation (Finding the Moment)

| Feature | Description |
|---------|-------------|
| **Thumbnail filmstrip** | Visual preview grid showing snapshots across the buffer. Tap to jump to that approximate time. |
| **Timeline scrubber** | Horizontal slider spanning the full buffer. Drag for continuous positioning to any point. |
| **Frame step** | ◀ ▶ buttons to move exactly one frame forward or backward. Essential for precise trim points. |

### Trimming (Selecting the Clip)

| Feature | Description |
|---------|-------------|
| **Mark In** | Button to set the start point of the clip at current playback position. |
| **Mark Out** | Button to set the end point of the clip at current playback position. |
| **Range indicator** | Visual highlight on timeline showing the selected in/out range. |
| **Trim preview** | Play button plays only the selected range, so you can verify before sharing. |
| **Clear selection** | Reset in/out points to start over. |

### Export (Sharing the Clip)

| Feature | Description |
|---------|-------------|
| **Share button** | Opens native share sheet with the trimmed clip. |
| **Fallback download** | On desktop or when share sheet unavailable, downloads the file. |
| **Format** | Standard video format that plays everywhere (MP4 preferred). |

### Zoom (During Replay)

Recording captures the **full unzoomed frame** at camera's native resolution. Zoom during replay is digital zoom into this recorded footage.

| Feature | Description |
|---------|-------------|
| **Zoom toggle** | Turn zoom on/off during replay. Off = full frame view. |
| **Pinch/scroll zoom** | Standard gesture to zoom into details (hand position, etc.). |
| **Pan** | Drag to move around when zoomed in. |
| **Zoom indicator** | Show current zoom level (1x, 2x, etc.). |

**Export behavior:**
- Default: Export full frame (maximum flexibility for recipient)
- Option: Export zoomed view (crop to what you see)

### Recording Quality

Higher resolution = better zoom headroom during review. At 2x zoom:
- 1080p capture → 540p effective (blocky)
- 4K capture → 1080p effective (sharp)

**Decision:** Always capture at camera's maximum resolution. No user setting - auto-detect and use the best available. Storage cost is worth the zoom headroom for practice review.

## Acceptance Criteria

### Thumbnail Navigation
- [ ] Filmstrip displays evenly-spaced preview images across buffer duration
- [ ] Tapping a thumbnail jumps playback to that point
- [ ] Current position is visually highlighted in filmstrip

### Timeline Scrubber
- [ ] Scrubber spans full buffer duration
- [ ] Dragging updates video position in real-time
- [ ] Current time displays numerically (e.g., "12.3s")
- [ ] In/out markers visible on scrubber when set

### Frame Stepping
- [ ] "◀" button moves back exactly one frame
- [ ] "▶" button moves forward exactly one frame
- [ ] Works when paused (primary use case)
- [ ] Frame position updates displayed time

### Trim Selection
- [ ] "In" button sets start point at current position
- [ ] "Out" button sets end point at current position
- [ ] Cannot set Out before In (either prevent or swap)
- [ ] Range visually highlighted on timeline
- [ ] Minimum clip duration: 0.5 seconds
- [ ] "Clear" resets to full buffer

### Trim Preview
- [ ] Play button respects in/out range
- [ ] Playback stops (or loops) at Out point
- [ ] Playback starts from In point

### Share Export
- [ ] Share button exports only the trimmed selection
- [ ] Native share sheet opens on supported platforms
- [ ] File downloads on desktop/unsupported platforms
- [ ] Exported video plays in standard video players
- [ ] Export shows progress indicator for longer clips

### Zoom Controls
- [ ] Zoom toggle button enables/disables zoom during replay
- [ ] Pinch gesture (mobile) and scroll wheel (desktop) adjust zoom level
- [ ] Pan via drag when zoomed in
- [ ] Zoom level indicator visible (e.g., "2.0x")
- [ ] Zoom resets to 1x when entering replay mode
- [ ] Export option: full frame vs. cropped to current zoom

### Recording Quality
- [ ] System detects camera's maximum resolution
- [ ] Always uses maximum available resolution
- [ ] Graceful fallback if max resolution fails

## Out of Scope (Future)

- Slow-motion playback (0.25x, 0.5x speeds)
- Loop selection continuously
- Side-by-side comparison of two moments
- Annotations / markers
- Cloud storage / sync
- Configurable buffer duration (fixed at 60s for now)

## Open Questions

1. **Thumbnail count** - How many thumbnails feel right? 8 (current)? Scale with screen size?
2. **Audio** - Is audio being captured? Should it be included in exports?
3. **Export crop UX** - How to choose between full frame vs. zoomed export? Toggle? Two buttons?

## Success Metrics

- User can go from "that was cool" to "shared clip" in under 30 seconds
- Trim precision allows selecting exactly the desired moment (no unwanted frames)
- Exported clips play without issues on receiving devices
