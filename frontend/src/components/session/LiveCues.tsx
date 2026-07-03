import { useEffect, useRef, useState } from 'react'

interface LiveCuesProps {
  analyserNode: AnalyserNode | null
  isPaused: boolean
}

export function LiveCues({ analyserNode, isPaused }: LiveCuesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [volume, setVolume] = useState(0)
  const [pauses, setPauses] = useState(0)
  const [isSilent, setIsSilent] = useState(false)
  const silenceStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (!analyserNode || isPaused) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let animationId: number

    const draw = () => {
      animationId = requestAnimationFrame(draw)
      analyserNode.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3b82f6'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0
      let sum = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = v * (canvas.height / 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
        sum += Math.abs(v - 1)
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()

      const avgVolume = sum / bufferLength
      setVolume(avgVolume)

      // Very simple silence detection
      if (avgVolume < 0.02) {
        if (!silenceStartRef.current) silenceStartRef.current = Date.now()
        else if (Date.now() - silenceStartRef.current > 1500 && !isSilent) {
          setIsSilent(true)
          setPauses(p => p + 1)
        }
      } else {
        silenceStartRef.current = null
        setIsSilent(false)
      }
    }
    draw()
    return () => cancelAnimationFrame(animationId)
  }, [analyserNode, isPaused, isSilent])

  return (
    <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-4 backdrop-blur-sm shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[12px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Live Telemetry
        </h4>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Est. Pace</div>
            <div className="text-sm font-bold text-blue-400">
              {volume > 0.05 ? 'Speaking...' : 'Listening...'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Pauses {'>'}1.5s</div>
            <div className="text-sm font-bold text-amber-400">{pauses}</div>
          </div>
        </div>
      </div>
      <div className="h-16 w-full rounded-lg overflow-hidden bg-slate-950/50 relative border border-slate-800">
        {isPaused && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[11px] font-bold text-white tracking-widest z-10">
            PAUSED
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full" width={400} height={64} />
      </div>
    </div>
  )
}
