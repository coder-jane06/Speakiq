import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react'

export interface AudioPlayerRef {
  seekTo: (time: number) => void
  getCurrentTime: () => number
}

interface AudioPlayerProps {
  src: string
  onTimeUpdate?: (currentTime: number) => void
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  ({ src, onTimeUpdate }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)
    const [isMuted, setIsMuted] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isLoading, setIsLoading] = useState(true)

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time
          setCurrentTime(time)
        }
      },
      getCurrentTime: () => currentTime,
    }))

    useEffect(() => {
      const audio = audioRef.current
      if (!audio) return

      const handleLoadedMetadata = () => {
        // WebM blobs can report Infinity initially — wait for durationchange
        if (isFinite(audio.duration)) {
          setDuration(audio.duration)
        }
        setIsLoading(false)
      }

      const handleDurationChange = () => {
        if (isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration)
        }
      }

      const handleTimeUpdate = () => {
        const time = audio.currentTime
        setCurrentTime(time)
        onTimeUpdate?.(time)
      }

      const handleEnded = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }

      const handleError = () => {
        console.error('Audio playback error')
        setIsLoading(false)
      }

      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('durationchange', handleDurationChange)
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('error', handleError)

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('durationchange', handleDurationChange)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('error', handleError)
      }
    }, [onTimeUpdate])

    const togglePlay = () => {
      if (!audioRef.current) return

      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      if (audioRef.current) {
        audioRef.current.currentTime = time
        setCurrentTime(time)
      }
    }

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value)
      setVolume(vol)
      if (audioRef.current) {
        audioRef.current.volume = vol
      }
      if (vol === 0) {
        setIsMuted(true)
      } else {
        setIsMuted(false)
      }
    }

    const toggleMute = () => {
      if (!audioRef.current) return

      if (isMuted) {
        audioRef.current.volume = volume
        setIsMuted(false)
      } else {
        audioRef.current.volume = 0
        setIsMuted(true)
      }
    }

    const changePlaybackRate = () => {
      const rates = [0.75, 1, 1.25, 1.5, 2]
      const currentIndex = rates.indexOf(playbackRate)
      const nextIndex = (currentIndex + 1) % rates.length
      const newRate = rates[nextIndex]
      
      setPlaybackRate(newRate)
      if (audioRef.current) {
        audioRef.current.playbackRate = newRate
      }
    }

    const skip = (seconds: number) => {
      if (!audioRef.current) return
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }

    const formatTime = (time: number) => {
      if (!isFinite(time) || isNaN(time) || time === 0) return '0:00'
      const minutes = Math.floor(time / 60)
      const seconds = Math.floor(time % 60)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    const formatDuration = (time: number) => {
      if (!isFinite(time) || isNaN(time) || time === 0) return '--:--'
      const minutes = Math.floor(time / 60)
      const seconds = Math.floor(time % 60)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <div 
        className="w-full rounded-[22px] p-6 bg-[var(--bg-card)] border border-[var(--border)] shadow-sm"
      >
        {/* Hidden audio element */}
        <audio ref={audioRef} src={src} preload="metadata" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center">
              <Volume2 size={16} style={{ color: 'var(--accent)' }} />
            </div>
            Your Speaking Recording
          </h3>
          {isLoading && (
            <span className="text-[11px] text-[var(--text-tertiary)] font-medium">Loading...</span>
          )}
        </div>

        {/* Seek bar */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3E8C00 0%, #3E8C00 ${progress}%, var(--bg-hover) ${progress}%, var(--bg-hover) 100%)`,
            }}
          />
          <div className="flex items-center justify-between mt-2 text-[12px] font-semibold text-[var(--text-secondary)]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Playback controls */}
          <div className="flex items-center gap-2">
            {/* Skip backward */}
            <button
              onClick={() => skip(-10)}
              disabled={isLoading}
              className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Skip back 10s"
            >
              <SkipBack size={16} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => skip(10)}
              disabled={isLoading}
              className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Skip forward 10s"
            >
              <SkipForward size={16} />
            </button>

            {/* Playback speed */}
            <button
              onClick={changePlaybackRate}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-[12px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
          </div>

          {/* Right: Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              disabled={isLoading}
              className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              disabled={isLoading}
              className="w-24 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(isMuted ? 0 : volume) * 100}%, var(--bg-hover) ${(isMuted ? 0 : volume) * 100}%, var(--bg-hover) 100%)`,
              }}
            />
          </div>
        </div>

        {/* Styling for range inputs */}
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--accent);
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          input[type="range"]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--accent);
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          input[type="range"]:disabled::-webkit-slider-thumb {
            cursor: not-allowed;
            opacity: 0.5;
          }

          input[type="range"]:disabled::-moz-range-thumb {
            cursor: not-allowed;
            opacity: 0.5;
          }
        `}</style>
      </div>
    )
  }
)

AudioPlayer.displayName = 'AudioPlayer'
