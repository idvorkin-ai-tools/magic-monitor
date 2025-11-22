import { useEffect, useRef, useState } from 'react';
import { useFlashDetector } from '../hooks/useFlashDetector';

export function CameraStage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    // Zoom/Pan State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Flash Detection State
    const [flashEnabled, setFlashEnabled] = useState(false);
    const [targetColor, setTargetColor] = useState<{ r: number; g: number; b: number } | null>(null);
    const [threshold, setThreshold] = useState(20);
    const [isPickingColor, setIsPickingColor] = useState(false);

    const isFlashing = useFlashDetector({
        videoRef,
        enabled: flashEnabled,
        targetColor,
        threshold
    });

    useEffect(() => {
        async function setupCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        facingMode: 'user',
                    },
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Error accessing camera:', err);
                setError('Could not access camera. Please allow camera permissions.');
            }
        }

        setupCamera();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const newZoom = Math.min(Math.max(zoom - e.deltaY * 0.001, 1), 5);
        setZoom(newZoom);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isPickingColor) {
            pickColor(e.clientX, e.clientY);
            return;
        }

        if (zoom > 1) {
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const pickColor = (x: number, y: number) => {
        if (!videoRef.current || !containerRef.current) return;

        const video = videoRef.current;
        const rect = video.getBoundingClientRect();

        // Calculate relative position on video
        const scaleX = video.videoWidth / rect.width;
        const scaleY = video.videoHeight / rect.height;

        const videoX = (x - rect.left) * scaleX;
        const videoY = (y - rect.top) * scaleY;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const pixel = ctx.getImageData(videoX, videoY, 1, 1).data;

        setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        setIsPickingColor(false);
        setFlashEnabled(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoom > 1 && !isPickingColor) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;

            setPan(prev => ({
                x: prev.x + dx / zoom,
                y: prev.y + dy / zoom
            }));

            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full bg-black overflow-hidden flex items-center justify-center ${isPickingColor ? 'cursor-crosshair' : 'cursor-move'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Flash Warning Overlay */}
            <div className={`absolute inset-0 border-[20px] border-red-600 z-40 pointer-events-none transition-opacity duration-100 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />

            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 text-red-500">
                    <p className="text-xl font-bold">{error}</p>
                </div>
            )}

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out"
                style={{
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`
                }}
            />

            {/* Controls Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-4 items-center z-50 w-full max-w-2xl px-4">

                {/* Flash Controls */}
                <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl flex items-center gap-4 w-full justify-center border border-white/10">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-full border-2 border-white"
                            style={{ backgroundColor: targetColor ? `rgb(${targetColor.r},${targetColor.g},${targetColor.b})` : 'transparent' }}
                        />
                        <button
                            onClick={() => setIsPickingColor(!isPickingColor)}
                            className={`px-3 py-1 rounded font-bold text-sm ${isPickingColor ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                        >
                            {isPickingColor ? 'Click Video' : 'Pick Color'}
                        </button>
                    </div>

                    <div className="h-8 w-px bg-white/20 mx-2" />

                    <label className="flex items-center gap-2 text-white text-sm">
                        <span>Threshold:</span>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={threshold}
                            onChange={(e) => setThreshold(parseInt(e.target.value))}
                            className="w-24 accent-red-500"
                        />
                        <span className="w-6 text-right">{threshold}</span>
                    </label>

                    <div className="h-8 w-px bg-white/20 mx-2" />

                    <button
                        onClick={() => setFlashEnabled(!flashEnabled)}
                        className={`px-4 py-1 rounded font-bold transition-colors ${flashEnabled ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}
                    >
                        {flashEnabled ? 'ARMED' : 'DISARMED'}
                    </button>
                </div>

                {/* Zoom Controls */}
                <div className="bg-black/50 backdrop-blur-md p-4 rounded-full flex items-center gap-4">
                    <button
                        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                        className="text-white font-bold px-3 py-1 rounded hover:bg-white/20 text-sm"
                    >
                        Reset Zoom
                    </button>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.1"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-48 accent-blue-500"
                    />
                    <span className="text-white font-mono w-12 text-right">{zoom.toFixed(1)}x</span>
                </div>
            </div>
        </div>
    );
}
