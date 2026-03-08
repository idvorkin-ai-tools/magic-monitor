# Card Detection Feature Design

**Date:** 2026-03-08
**Status:** Approved

## Core Goal

Real-time 52-class playing card detection running alongside existing MediaPipe hand tracking in the browser. Detect multiple cards simultaneously with exact identification (Ace of Spades, 7 of Hearts, etc.).

## Architecture

```
Camera Frame (shared with hand tracking)
    ↓
ONNX Runtime Web (WebGL/WebGPU)
    ↓
YOLO model (52 classes, ~20MB ONNX)
    ↓
Detections: [{card: "Ace_Spades", bbox, confidence}, ...]
    ↓
Combine with HandLandmarker results
    ↓
UI overlay: bounding boxes + card labels on video
```

### Runtime Stack

- **Model format**: ONNX (exported from Roboflow YOLO playing card detector)
- **Inference engine**: `onnxruntime-web` with WebGL2 execution provider
- **Frame source**: Reuse same downscaled canvas frame used by hand tracking
- **Update rate**: ~15-30fps (throttled to not compete with hand tracking GPU)
- **All local**: No cloud calls, works offline, same as hand tracking

## Components

### 1. CardDetectorService (`src/services/CardDetectorService.ts`)

Singleton pattern matching HandLandmarkerService:
- Loads ONNX model from `/public/models/card-detector.onnx`
- Creates ONNX inference session with WebGL2 backend
- Exposes `detect(imageData): CardDetection[]`
- Handles model loading state and errors
- Pre/post-processing: resize input to model dimensions, parse output tensors into bounding boxes + class IDs + confidence scores
- NMS (non-max suppression) to deduplicate overlapping detections

### 2. useCardDetection hook (`src/hooks/useCardDetection.ts`)

Same pattern as useSmartZoom:
- Runs detection loop via requestAnimationFrame
- Shares downscaled canvas frame with hand tracking
- Stores results in ref (not state) for 60fps reads
- Throttles React state updates to ~10Hz for UI
- Exposes: `detections: CardDetection[]`, `isModelLoaded: boolean`, `isEnabled: boolean`
- Configurable confidence threshold (default 0.5)

### 3. CardOverlay component (`src/components/CardOverlay.tsx`)

Renders on top of video element:
- Colored bounding box around each detected card
- Label showing card shorthand: "A♠", "7♥", "K♦", "J♣" etc.
- Confidence percentage (toggleable)
- Transforms match video transforms (mirror, zoom, pan)

### 4. CardList component (`src/components/CardList.tsx`)

Small panel in corner of screen:
- Shows all currently visible cards as a list
- Updates in real-time
- Useful for tracking what's been shown during a routine

### 5. Settings integration

Add to SettingsModal:
- Card detection toggle (on/off)
- Confidence threshold slider (0.1 - 0.9)
- Show/hide bounding boxes toggle
- Show/hide card list panel toggle

## Data Types

```typescript
interface CardDetection {
  card: PlayingCard;       // { rank: Rank, suit: Suit }
  label: string;           // "A♠", "7♥", etc.
  bbox: BoundingBox;       // { x, y, width, height } normalized 0-1
  confidence: number;      // 0-1
}

type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type Suit = '♠' | '♥' | '♦' | '♣';

interface BoundingBox {
  x: number;      // normalized center x
  y: number;      // normalized center y
  width: number;  // normalized width
  height: number; // normalized height
}
```

## Model Sourcing

- Use Roboflow Universe playing card datasets (52-class, well-labeled)
- Export as ONNX format for onnxruntime-web
- Model stored in `/public/models/card-detector.onnx`
- Fallback: Train custom YOLOv8n on Roboflow, export to ONNX (~15-25MB)

## Integration with Existing Features

- **Hand tracking**: Both run on same frame. Can correlate: "hand at position X is holding card Y"
- **Session recording**: Card detections logged alongside recording for replay annotation
- **Replay mode**: Show detected cards in timeline (which cards were visible at each moment)
- **Flash detection**: Card detection could eventually replace flash detection for "was the card exposed?" checks

## Performance Considerations

- ONNX Runtime Web shares WebGL2 context — may need to alternate frames with MediaPipe
- If GPU contention is an issue, run card detection every 2nd or 3rd frame
- Model input size affects speed: 320x320 is fast, 640x640 is accurate
- Start with 416x416 as compromise
- Monitor frame rate and auto-throttle if drops below 20fps
