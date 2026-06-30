import { useCallback, useEffect, useRef, useState } from 'react'

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function pickRecorderMimeType(): string {
  const isIOS = isIOSDevice()

  const candidates = isIOS
    ? ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm']
    : [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export type AudioRecorderError =
  | 'unsupported'
  | 'permission_denied'
  | 'not_found'
  | 'unknown'

export function audioRecorderErrorMessage(error: AudioRecorderError): string {
  if (error === 'unsupported') {
    return 'Seu navegador não suporta gravação de áudio. Tente no Chrome ou Safari atualizado.'
  }
  if (error === 'permission_denied') {
    return 'Permita o acesso ao microfone nas configurações do navegador.'
  }
  if (error === 'not_found') {
    return 'Nenhum microfone encontrado neste dispositivo.'
  }
  return 'Não foi possível gravar áudio. Tente novamente.'
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [lastError, setLastError] = useState<AudioRecorderError | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const mimeTypeRef = useRef('')

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const mapGetUserMediaError = useCallback((error: unknown): AudioRecorderError => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'permission_denied'
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return 'not_found'
      }
    }
    return 'unknown'
  }, [])

  const startRecording = useCallback(async (): Promise<boolean> => {
    setLastError(null)

    const mimeType = pickRecorderMimeType()
    if (!mimeType || typeof MediaRecorder === 'undefined') {
      setLastError('unsupported')
      return false
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setLastError('unsupported')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      chunksRef.current = []
      mimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.start(isIOSDevice() ? 1000 : 200)
      setIsRecording(true)
      setDuration(0)
      stopTimer()
      timerRef.current = window.setInterval(() => {
        setDuration((value) => value + 1)
      }, 1000)

      return true
    } catch (error) {
      cleanupStream()
      setLastError(mapGetUserMediaError(error))
      return false
    }
  }, [cleanupStream, mapGetUserMediaError, stopTimer])

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; mimeType: string } | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false)
      stopTimer()
      cleanupStream()
      return null
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
        chunksRef.current = []
        recorderRef.current = null
        setIsRecording(false)
        setDuration(0)
        stopTimer()
        cleanupStream()
        resolve(blob.size > 0 ? { blob, mimeType: mimeTypeRef.current } : null)
      }

      recorder.stop()
    })
  }, [cleanupStream, stopTimer])

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    chunksRef.current = []
    recorderRef.current = null
    setIsRecording(false)
    setDuration(0)
    stopTimer()
    cleanupStream()
  }, [cleanupStream, stopTimer])

  useEffect(() => {
    return () => {
      stopTimer()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      cleanupStream()
    }
  }, [cleanupStream, stopTimer])

  return {
    isRecording,
    duration,
    lastError,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}

export function formatRecordingDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
