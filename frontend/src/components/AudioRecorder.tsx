import { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

export function AudioWaveform({ analyserNode, isRecording }: { analyserNode: AnalyserNode | null, isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyserNode || !isRecording) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use full width of container, high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationId: number;
    
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineWidth = 3;
      // Fetch accent color from CSS variables
      const computedStyle = getComputedStyle(document.body);
      ctx.strokeStyle = computedStyle.getPropertyValue('--accent').trim() || '#C8F97D';
      ctx.beginPath();

      const sliceWidth = rect.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 128 is center
        const y = v * (rect.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Smooth bezier curve for waveform
          const prevX = x - sliceWidth;
          const prevY = (dataArray[i-1] / 128.0) * (rect.height / 2);
          const cp1x = prevX + sliceWidth / 2;
          const cp1y = prevY;
          const cp2x = x - sliceWidth / 2;
          const cp2y = y;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(rect.width, rect.height / 2);
      ctx.stroke();
    };

    draw();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isRecording]);

  return (
    <div className="w-full h-[140px] md:h-[180px] flex items-center justify-center relative bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-inner overflow-hidden">
      {/* Grid background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full relative z-10"
        style={{ opacity: isRecording ? 1 : 0.2, transition: 'opacity 0.3s' }}
      />
      {!isRecording && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
           <span className="text-[var(--text-tertiary)] font-bold tracking-widest uppercase text-sm">Standby</span>
        </div>
      )}
    </div>
  );
}

export function RecordButton({ isRecording, onClick }: { isRecording: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
        isRecording 
          ? 'bg-red-500/10 border border-red-500 hover:bg-red-500/20' 
          : 'bg-[var(--accent)] text-white dark:text-black hover:scale-105'
      }`}
    >
      {isRecording ? (
        <div className="w-8 h-8 rounded-md bg-red-500" />
      ) : (
        <Mic size={32} strokeWidth={2.5} />
      )}
    </button>
  );
}