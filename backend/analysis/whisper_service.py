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
    probability: float = 1.0  # Whisper confidence score (0–1). < 0.65 = potentially misheard.


@dataclass
class TranscriptResult:
    transcript: str
    words: list[WordTimestamp] = field(default_factory=list)
    language: str = "en"
    duration_secs: float = 0.0
    word_count: int = 0
    # Words the model was < 65% confident about — may be mispronounced or misheard.
    uncertain_words: list[str] = field(default_factory=list)


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

    async def _transcribe_with_groq(
        self,
        audio_bytes: bytes,
        filename: str = "recording.webm"
    ) -> Optional[TranscriptResult]:
        """
        Primary transcription path: Groq's whisper-large-v3-turbo.

        WHY GROQ OVER LOCAL BASE:
        - whisper-large-v3-turbo is ~8x larger than the local 'base' model
        - Dramatically better at accents, unclear pronunciation, and non-native speech
        - Uses the GROQ_API_KEY already configured in the app — no extra cost
        - Free tier: 2 hours of audio/day (plenty for a coaching app)
        - Falls back to local faster-whisper if Groq is unavailable

        ACCENT HANDLING:
        - The 'prompt' parameter biases Whisper toward natural English transcription
          and reduces hallucinations on accented speech
        - whisper-large-v3-turbo was specifically trained on diverse accents
        """
        import os
        groq_key = os.getenv("GROQ_API_KEY", "")
        if not groq_key:
            return None
        try:
            from groq import Groq
            from fastapi.concurrency import run_in_threadpool

            # Detect actual audio format for correct MIME type
            # Groq validates file extensions — sending .webm when it's actually .wav will fail
            ext = "webm"
            if audio_bytes.startswith(b"RIFF") and audio_bytes[8:12] == b"WAVE":
                ext = "wav"
            elif audio_bytes.startswith(b"OggS"):
                ext = "ogg"
            elif len(audio_bytes) >= 12 and audio_bytes[4:8] == b"ftyp":
                ext = "m4a"
            elif audio_bytes.startswith(b"ID3") or audio_bytes.startswith(b"\xff\xfb"):
                ext = "mp3"
            elif audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
                ext = "webm"

            actual_filename = f"recording.{ext}"

            client = Groq(api_key=groq_key)

            # The Groq API is synchronous — run in thread pool to avoid blocking the event loop
            def _call_groq():
                return client.audio.transcriptions.create(
                    file=(actual_filename, audio_bytes),
                    model="whisper-large-v3-turbo",
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                    language="en",
                    # Prompt biases the model toward careful English transcription.
                    # This significantly improves accuracy for accented speakers by
                    # reducing hallucinated words and misheard syllables.
                    prompt=(
                        "Transcribe the following English speech accurately. "
                        "The speaker may have a non-native accent. Listen carefully "
                        "to each word and prefer common English words over rare ones "
                        "when the pronunciation is ambiguous."
                    ),
                )

            response = await run_in_threadpool(_call_groq)

            full_text = (response.text or "").strip()
            words: list[WordTimestamp] = []
            if hasattr(response, 'words') and response.words:
                for w in response.words:
                    words.append(WordTimestamp(
                        word=str(w.word),
                        start=round(float(w.start), 2),
                        end=round(float(w.end), 2),
                        probability=1.0  # Groq large model — high accuracy
                    ))
            word_count  = len(full_text.split()) if full_text else 0
            duration    = float(getattr(response, 'duration', 0.0))
            lang        = str(getattr(response, 'language', 'en'))
            logger.info(
                f"[WhisperService] Groq transcription done — "
                f"{word_count} words, {duration:.1f}s, format={ext}"
            )
            return TranscriptResult(
                transcript=full_text,
                words=words,
                language=lang,
                duration_secs=duration,
                word_count=word_count,
                uncertain_words=[],  # Large model + accent prompt = trust the output
            )
        except Exception as e:
            logger.warning(f"[WhisperService] Groq transcription failed, will use local model: {e}")
            return None


    async def transcribe_from_bytes(
        self,
        audio_bytes: bytes,
        filename: str = "recording.webm"
    ) -> Optional[TranscriptResult]:
        """
        Transcribe audio from raw bytes.
        Tries Groq Whisper first (better accuracy, free), then falls back to local faster-whisper.
        """
        if self.model is None and not os.getenv("GROQ_API_KEY"):
            logger.error("[WhisperService] No Groq API key and local model failed to load — cannot transcribe")
            return None

        # --- Primary path: Groq whisper-large-v3-turbo (better accent handling) ---
        if len(audio_bytes) >= 1000:
            groq_result = await self._transcribe_with_groq(audio_bytes, filename)
            if groq_result and groq_result.word_count > 0:
                return groq_result
            if groq_result is not None:
                logger.warning("[WhisperService] Groq returned empty transcript — falling back to local model")

        # --- Fallback path: local faster-whisper base model ---
        if self.model is None:
            logger.error("[WhisperService] Local model not available and Groq failed — cannot transcribe")
            return None

        # Write bytes to temp file
        # IMPORTANT: On Windows, we must close the file before external tools can read it
        tmp = tempfile.NamedTemporaryFile(
            suffix=f"_{filename}",
            delete=False,
            mode='wb'  # Explicitly set binary write mode
        )
        tmp_path = None
        try:
            tmp.write(audio_bytes)
            tmp.flush()  # Ensure all bytes are written to disk
            os.fsync(tmp.fileno())  # Force OS to write to disk (critical on Windows)
            tmp_path = tmp.name
            tmp.close()  # Close the file handle so other processes can access it
            
            logger.info(f"[WhisperService] Temp file created: {tmp_path} ({len(audio_bytes)} bytes)")
            
            # Verify file exists and has content before transcription
            if not os.path.exists(tmp_path):
                logger.error(f"[WhisperService] Temp file disappeared: {tmp_path}")
                return None
            
            file_size = os.path.getsize(tmp_path)
            logger.info(f"[WhisperService] Temp file verified: {file_size} bytes")
            
            if file_size == 0:
                logger.error(f"[WhisperService] Temp file is empty!")
                return None
            
            # Run transcription
            result = await self.transcribe(tmp_path)
            
            return result
            
        except Exception as e:
            logger.error(f"[WhisperService] transcribe_from_bytes failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
        finally:
            # Clean up temp file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    logger.debug(f"[WhisperService] Deleted temp file: {tmp_path}")
                except Exception as e:
                    logger.warning(f"[WhisperService] Could not delete temp file: {e}")

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
            def run_transcription(vad_filter: bool):
                segments, info = self.model.transcribe(
                    audio_path,
                    language=language,
                    word_timestamps=True,   # get word-level timestamps
                    beam_size=5,            # higher = more accurate, slower
                    vad_filter=vad_filter,  # filter out silence automatically
                )
                return list(segments), info

            segments, info = await run_in_threadpool(run_transcription, True)

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
                            end=round(float(w.end), 2),
                            probability=round(float(getattr(w, 'probability', 1.0)), 3)
                        ))

            transcript_text = " ".join(full_text_parts).strip()
            word_count      = len(transcript_text.split()) if transcript_text else 0
            duration        = float(info.duration) if hasattr(info, 'duration') else 0.0

            # Some valid browser recordings get over-filtered by VAD. If the
            # recording has real duration but VAD found nothing, retry once
            # without VAD before calling it no-speech.
            if word_count == 0 and duration >= 5.0:
                logger.warning(
                    "[WhisperService] VAD produced 0 words for %.1fs audio; retrying without VAD",
                    duration,
                )
                segments, info = await run_in_threadpool(run_transcription, False)
                words = []
                full_text_parts = []
                for segment in segments:
                    full_text_parts.append(segment.text.strip())
                    if segment.words:
                        for w in segment.words:
                            words.append(WordTimestamp(
                                word=w.word.strip(),
                                start=round(float(w.start), 2),
                                end=round(float(w.end), 2),
                                probability=round(float(getattr(w, 'probability', 1.0)), 3)
                            ))
                transcript_text = " ".join(full_text_parts).strip()
                word_count = len(transcript_text.split()) if transcript_text else 0
            duration        = float(info.duration) if hasattr(info, 'duration') else 0.0
            detected_lang   = info.language if hasattr(info, 'language') else language

            # Compute uncertain words (probability < 0.65 = likely misheard or mispronounced)
            uncertain = [w.word for w in words if w.probability < 0.65]

            result = TranscriptResult(
                transcript=transcript_text,
                words=words,
                language=detected_lang,
                duration_secs=duration,
                word_count=word_count,
                uncertain_words=uncertain
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
