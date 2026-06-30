import { useEffect, useRef, useState } from 'react'
import { CheckCheck, Mic, Pause, Play } from 'lucide-react'

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface WhatsAppAudioPlayerProps {
  src: string
  sent?: boolean
  contactName?: string
  timeLabel?: string
}

function AudioAvatar({ name, sent }: { name: string; sent: boolean }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div className="relative shrink-0">
      <div
        className={`flex h-[50px] w-[50px] items-center justify-center rounded-full text-sm font-semibold ${
          sent ? 'bg-[#cfe9c6] text-[#128c7e]' : 'bg-[#dfe5e7] text-[#54656f]'
        }`}
      >
        {initials}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ${
          sent ? 'bg-[#25d366]' : 'bg-[#8696a0]'
        }`}
      >
        <Mic className="h-2.5 w-2.5 text-white" />
      </span>
    </div>
  )
}

export function WhatsAppAudioPlayer({
  src,
  sent = false,
  contactName = 'Contato',
  timeLabel,
}: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => setDuration(audio.duration || 0)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
      audio.currentTime = 0
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  return (
    <div className="flex min-w-[280px] max-w-[330px] items-start gap-2 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />

      <AudioAvatar name={contactName} sent={sent} />

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-[#111b21] transition-opacity hover:opacity-70"
            aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
          >
            {playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>

          <div className="relative h-[3px] min-w-0 flex-1 rounded-full bg-[#c5d4d0]/70">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[#4fb6ec]"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#4fb6ec] shadow-sm"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between pl-8 pr-1">
          <span className="text-[11px] tabular-nums text-[#667781]">
            {playing || currentTime > 0
              ? formatDuration(currentTime)
              : formatDuration(duration)}
          </span>
          {timeLabel && (
            <span className="flex items-center gap-0.5 text-[11px] text-[#667781]">
              {timeLabel}
              {sent && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
