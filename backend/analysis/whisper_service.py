# =============================================================
# backend/analysis/whisper_service.py
# Uses faster-whisper (local, completely free, no API key)
# =============================================================

import logging
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float


@dataclass
class TranscriptResult:
    transcript: str
    words: list[WordTimestamp] = field(default_factory=list)
    language: str = "en"
    duration_secs: float = 0.0
    word_count: int = 0


class WhisperService:
    """
    Transcribes audio using faster-whisper running locally.
    Completely free — no API key, no credits, no cost.

    HOW FASTER-WHISPER WORKS:
    It loads the Whisper model onto your CPU/GPU and runs
    inference locally. First run downloads the model (~150MB).
    Subsequent runs use the cached model instantly.

    MODEL SIZES:
    "tiny"   - fastest, least accurate (~75MB)
    "base"   - good balance (~150MB)  ← we use this
    "small"  - better accuracy (~500MB)
    "medium" - near OpenAI quality (~1.5GB)
    """

    def __init__(self):
        try:
            from faster_whisper import WhisperModel

            # "base" model — good accuracy, fast on CPU
            # device="cpu" — works on any machine
            # compute_type="int8" — uses less memory, still accurate
            self.model = WhisperModel(
                "base",
                device="cpu",
                compute_type="int8"
            )
            logger.info("[WhisperService] faster-whisper loaded (base model)")
        except Exception as e:
            logger.error(f"[WhisperService] Failed to load model: {e}")
            self.model = None

    async def transcribe_from_bytes(
        self,
        audio_bytes: bytes,
        filename: str = "recording.webm"
    ) -> Optional[TranscriptResult]:
        """
        Transcribe audio from raw bytes.
        Writes to a temp file, transcribes, deletes temp file.
        """
        if self.model is None:
            logger.error("[WhisperService] Model not loaded")
            return None

        # Write bytes to temp file
        with tempfile.NamedTemporaryFile(
            suffix=f"_{filename}",
            delete=False
        ) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            return await self.transcribe(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    async def transcribe(
        self,
        audio_path: str,
        language: str = "en"
    ) -> Optional[TranscriptResult]:
        """
        Transcribe an audio file using faster-whisper.

        faster-whisper returns segments (chunks of speech).
        Each segment contains words with timestamps.
        We flatten all segments into one transcript.
        """
        audio_file = Path(audio_path)
        if not audio_file.exists():
            logger.error(f"[WhisperService] File not found: {audio_path}")
            return None

        logger.info(f"[WhisperService] Transcribing {audio_file.name}...")

        try:
            from fastapi.concurrency import run_in_threadpool

            # faster-whisper is CPU-bound so we run it in
            # a thread pool — same pattern as Librosa
            def run_transcription():
                segments, info = self.model.transcribe(
                    audio_path,
                    language=language,
                    word_timestamps=True,   # get word-level timestamps
                    beam_size=5,            # higher = more accurate, slower
                    vad_filter=True,        # filter out silence automatically
                )
                return list(segments), info

            segments, info = await run_in_threadpool(run_transcription)

            # Flatten all segments into words and full transcript
            words = []
            full_text_parts = []

            for segment in segments:
                full_text_parts.append(segment.text.strip())

                # Each segment has a .words attribute
                if segment.words:
                    for w in segment.words:
                        words.append(WordTimestamp(
                            word=w.word.strip(),
                            start=round(float(w.start), 2),
                            end=round(float(w.end), 2)
                        ))

            transcript_text = " ".join(full_text_parts).strip()
            word_count      = len(transcript_text.split()) if transcript_text else 0
            duration        = float(info.duration) if hasattr(info, 'duration') else 0.0
            detected_lang   = info.language if hasattr(info, 'language') else language

            result = TranscriptResult(
                transcript=transcript_text,
                words=words,
                language=detected_lang,
                duration_secs=duration,
                word_count=word_count
            )

            logger.info(
                f"[WhisperService] Done — {word_count} words, "
                f"{duration:.1f}s, language: {detected_lang}"
            )

            return result

        except Exception as e:
            logger.error(
                f"[WhisperService] Transcription failed: "
                f"{type(e).__name__}: {e}"
            )
            return None


# Module-level singleton
whisper_service = WhisperService()