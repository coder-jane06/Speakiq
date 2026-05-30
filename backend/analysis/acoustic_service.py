# =============================================================
# backend/analysis/acoustic_service.py
#
# WHAT THIS FILE DOES:
#   Takes a raw audio file → extracts acoustic features:
#   speech rate, pauses, pitch variation, energy, monotony
#
# WHAT YOU LEARN HERE:
#   - Signal processing concepts (what audio actually is)
#   - numpy arrays (the foundation of all Python data science)
#   - How librosa works (audio → numbers)
#   - How VAD (Voice Activity Detection) works
#   - Running CPU-heavy code without blocking the server
#   - The difference between sync and async functions
#
# WHY THIS MATTERS FOR SPEAKIQ:
#   The transcript tells us WHAT someone said.
#   Acoustic analysis tells us HOW they said it.
#   A great speaker and a nervous speaker can say the exact
#   same words — but the acoustic features are completely
#   different. Pauses, pace, pitch variation — these are
#   the real signals of speaking confidence.
# =============================================================

import logging
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import librosa

logger = logging.getLogger(__name__)

# Try to find ffmpeg in system path first
import shutil
if not shutil.which("ffmpeg"):
    # Fallback to local unzipped ffmpeg
    local_ffmpeg_bin = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        '..', '..', 'ffmpeg_unzipped', 'ffmpeg-7.0-essentials_build', 'bin'
    )
    os.environ['PATH'] = local_ffmpeg_bin + os.pathsep + os.environ.get('PATH', '')


# -------------------------------------------------------------
# WHAT IS AUDIO, REALLY?
#
# Audio is just air pressure changing over time.
# A microphone converts those pressure changes into
# a sequence of numbers — this is called a "waveform".
#
# Example: [0.0, 0.02, 0.08, 0.15, 0.09, 0.01, -0.03, ...]
#
# Each number = the air pressure at one moment in time.
# If we sample 16,000 times per second (16kHz), we get
# 16,000 numbers per second of audio.
#
# That's all audio is. A long list of numbers.
# Librosa analyzes those numbers to extract meaning.
# -------------------------------------------------------------


# -------------------------------------------------------------
# DATACLASSES — our output data structures
# -------------------------------------------------------------

@dataclass
class PauseInfo:
    """
    A single detected pause in the speech.

    WHY TRACK PAUSES:
    Pauses reveal a lot about a speaker:
    - Short pauses (< 0.5s) = normal breathing, emphasis
    - Medium pauses (0.5-2s) = thinking, losing the thread
    - Long pauses (> 2s) = blanking out, lost confidence

    The timestamp lets us say "you went blank at 0:32"
    instead of just "you paused too long."
    """
    start: float       # when the pause started (seconds)
    end: float         # when the pause ended (seconds)
    duration: float    # how long it lasted (seconds)


@dataclass
class AcousticResult:
    """
    The complete acoustic analysis of one speaking session.

    Every field here maps to a coaching insight:
    - wpm too low = speaking too slowly
    - wpm too high = rushing, hard to follow
    - pitch_std near 0 = monotone delivery
    - silence_pct > 40% = too many pauses
    - longest_pause > 3s = blanking out problem
    """

    # --- Speech rate ---
    wpm: float = 0.0
    # Words Per Minute. Normal conversational speech = 130-150 WPM
    # Great speakers vary between 100-180 depending on content.
    # Source: Toastmasters International guidelines

    # --- Pauses ---
    pause_count: int = 0
    # Total number of distinct pauses detected

    longest_pause_sec: float = 0.0
    # Duration of the longest single pause
    # > 3 seconds = blanking out

    pause_list: list[PauseInfo] = field(default_factory=list)
    # Every pause with its exact timestamp

    silence_percentage: float = 0.0
    # What % of the total audio is silence
    # Calculated as: total_silence_duration / total_duration

    # --- Pitch (voice expressiveness) ---
    pitch_mean: float = 0.0
    # Average pitch in Hz. Male voices: ~120Hz. Female: ~210Hz.
    # We use this as a baseline to measure variation.

    pitch_std: float = 0.0
    # Standard deviation of pitch.
    # LOW std (< 20Hz) = monotone, robotic delivery
    # HIGH std (> 60Hz) = expressive, engaging delivery
    # This single number captures "does this person sound alive?"

    # --- Energy (volume consistency) ---
    energy_mean: float = 0.0
    # Average loudness of the speech segments

    energy_variance: float = 0.0
    # How much the loudness varies.
    # Very low variance = flat, tired delivery
    # Healthy variance = natural emphasis on key words

    # --- Summary ---
    speaking_duration_secs: float = 0.0
    # Total time actually speaking (excluding silences)

    total_duration_secs: float = 0.0
    # Total recording length

    monotony_score: float = 0.0
    # 0.0 = completely robotic, 1.0 = very expressive
    # Derived from pitch_std — normalized to 0-1 scale


# -------------------------------------------------------------
# THE SERVICE CLASS
# -------------------------------------------------------------

class AcousticService:
    """
    Analyzes the acoustic properties of a speech recording.

    IMPORTANT: Librosa is CPU-intensive. Loading audio and
    computing FFTs (Fast Fourier Transforms) uses a lot of
    processing power. This is why we use run_in_threadpool
    in FastAPI — to avoid blocking the server event loop.
    """

    # Sample rate we standardize all audio to.
    # 16kHz = 16,000 samples/second. High enough quality for
    # speech analysis, low enough to be fast to process.
    SAMPLE_RATE = 16000

    # Minimum pause duration to count as a real pause.
    # 0.3 seconds = 300ms. Shorter than this = just a breath,
    # not a meaningful pause.
    MIN_PAUSE_DURATION = 0.3

    def analyze(
        self,
        audio_path: str,
        word_count: int = 0
    ) -> Optional[AcousticResult]:
        """
        Run full acoustic analysis on an audio file.

        NOTE: This is NOT async — it's a regular synchronous
        function. That's intentional. Librosa uses numpy which
        uses C extensions under the hood. These can't be
        awaited. Instead, FastAPI's run_in_threadpool() will
        run this in a separate thread so it doesn't block.

        PARAMETERS:
            audio_path: path to the audio file
            word_count: from Whisper (used to calculate WPM)
        """

        audio_file = Path(audio_path)
        if not audio_file.exists():
            logger.error(f"[AcousticService] File not found: {audio_path}")
            return None

        logger.info(f"[AcousticService] Analyzing: {audio_file.name}")

        try:
            # --------------------------------------------------
            # STEP 1: Load the audio file into a numpy array
            #
            # librosa.load() reads the audio file and returns:
            #   y  = the waveform as a numpy array of floats
            #        e.g. array([ 0.001, 0.023, -0.012, ...])
            #   sr = the sample rate we loaded at (16000)
            #
            # sr=self.SAMPLE_RATE forces resampling to 16kHz.
            # mono=True converts stereo to mono (we don't need
            # left/right channels for speech analysis).
            # --------------------------------------------------
            import librosa
            import subprocess
            import os

            # Try system ffmpeg, fallback to local
            ffmpeg_path = shutil.which("ffmpeg")
            if not ffmpeg_path:
                ffmpeg_path = os.path.join(
                    os.path.dirname(os.path.abspath(__file__)),
                    '..', '..', 'ffmpeg_unzipped', 'ffmpeg-7.0-essentials_build', 'bin', 'ffmpeg.exe'
                )
                ffmpeg_path = os.path.normpath(ffmpeg_path)


            # Convert WebM to WAV (librosa reads WAV natively, no backend needed)
            wav_path = audio_path + '.converted.wav'
            try:
                result = subprocess.run(
                    [ffmpeg_path, '-y', '-i', audio_path,
                     '-ar', '16000', '-ac', '1',
                     '-f', 'wav', wav_path],
                    capture_output=True,
                    timeout=30
                )
                if result.returncode != 0:
                    logger.error(f"[AcousticService] ffmpeg failed: "
                                f"{result.stderr.decode()}")
                    return None
                load_path = wav_path
            except Exception as e:
                logger.error(f"[AcousticService] ffmpeg conversion failed: {e}")
                return None

            # Now load the WAV file — this always works
            y, sr = librosa.load(load_path, sr=self.SAMPLE_RATE, mono=True)

            # Clean up temp WAV file
            try:
                os.unlink(wav_path)
            except OSError:
                pass

            total_duration = librosa.get_duration(y=y, sr=sr)
            logger.info(f"[AcousticService] Loaded {total_duration:.1f}s of audio")

            # --------------------------------------------------
            # STEP 2: Detect pauses using RMS energy
            #
            # RMS = Root Mean Square. It measures the "loudness"
            # of a short window of audio.
            #
            # librosa.feature.rms() splits the audio into small
            # frames (windows) and computes the loudness of each.
            #
            # frame_length=512 = each frame is 512 samples
            # hop_length=256   = frames overlap by 256 samples
            # At 16kHz, each frame = 32ms of audio
            # --------------------------------------------------
            rms = librosa.feature.rms(
                y=y,
                frame_length=512,
                hop_length=256
            )[0]  # [0] because rms returns shape (1, n_frames)

            # Convert frame indices to timestamps
            # librosa.frames_to_time() tells us when each frame
            # starts in seconds
            frame_times = librosa.frames_to_time(
                np.arange(len(rms)),
                sr=sr,
                hop_length=256
            )

            # SILENCE THRESHOLD:
            # Any frame with RMS below this is considered silence.
            # We use a percentile of the actual audio rather than
            # a fixed number — this adapts to different microphones
            # and recording environments.
            # 15th percentile = quieter than 85% of the audio
            silence_threshold = np.percentile(rms, 15)

            # Create a boolean array: True = silent, False = speech
            is_silent = rms < silence_threshold

            # --------------------------------------------------
            # STEP 3: Convert the silence array into pause objects
            #
            # is_silent looks like:
            # [F, F, F, T, T, T, T, F, F, T, T, F, F, F, F, ...]
            #  speech      pause        p2    speech
            #
            # We walk through it finding where silence starts
            # and ends, then create PauseInfo objects.
            # --------------------------------------------------
            pauses = []
            in_pause = False
            pause_start = 0.0

            for i, silent in enumerate(is_silent):
                if silent and not in_pause:
                    # Silence just started
                    in_pause = True
                    pause_start = frame_times[i]
                elif not silent and in_pause:
                    # Silence just ended
                    in_pause = False
                    pause_duration = frame_times[i] - pause_start
                    if pause_duration >= self.MIN_PAUSE_DURATION:
                        pauses.append(PauseInfo(
                            start=round(pause_start, 2),
                            end=round(frame_times[i], 2),
                            duration=round(pause_duration, 2)
                        ))

            # Handle case where audio ends mid-pause
            if in_pause and len(frame_times) > 0:
                pause_duration = frame_times[-1] - pause_start
                if pause_duration >= self.MIN_PAUSE_DURATION:
                    pauses.append(PauseInfo(
                        start=round(pause_start, 2),
                        end=round(frame_times[-1], 2),
                        duration=round(pause_duration, 2)
                    ))

            # Calculate total silence duration
            total_silence = sum(p.duration for p in pauses)
            silence_pct   = (total_silence / total_duration * 100) if total_duration > 0 else 0
            longest_pause = max((p.duration for p in pauses), default=0.0)

            # --------------------------------------------------
            # STEP 4: Calculate speech rate (WPM)
            #
            # WPM = words spoken / minutes of actual speaking
            #
            # "Actual speaking" = total duration - total silence
            # We don't count silence in the denominator because
            # we want to measure speaking speed, not pause frequency.
            # Those are separate metrics.
            # --------------------------------------------------
            speaking_duration = total_duration - total_silence
            wpm = 0.0
            if word_count > 0 and speaking_duration > 0:
                minutes_speaking = speaking_duration / 60.0
                wpm = round(word_count / minutes_speaking, 1)

            # --------------------------------------------------
            # STEP 5: Pitch analysis
            #
            # Pitch = how high or low your voice sounds (Hz).
            # librosa.yin() estimates fundamental frequency (F0)
            # for each frame using the YIN algorithm.
            #
            # fmin/fmax: the range of human speech.
            # Below 80Hz = too low to be voice (background noise)
            # Above 400Hz = too high to be fundamental frequency
            # --------------------------------------------------
            f0 = librosa.yin(
                y,
                fmin=80,
                fmax=400,
                sr=sr,
                frame_length=2048,
                hop_length=256
            )

            # Filter out unvoiced frames (where pitch = 0 or NaN)
            # Unvoiced = silence or consonants with no pitch
            voiced_f0 = f0[(f0 > 80) & (f0 < 400) & ~np.isnan(f0)]

            if len(voiced_f0) > 10:
                pitch_mean = float(np.mean(voiced_f0))
                pitch_std  = float(np.std(voiced_f0))
            else:
                pitch_mean = 0.0
                pitch_std  = 0.0

            # --------------------------------------------------
            # STEP 6: Energy analysis
            #
            # We already computed RMS. Now we look at only the
            # non-silent frames to analyze speaking volume.
            # --------------------------------------------------
            speech_rms = rms[~is_silent]
            if len(speech_rms) > 0:
                energy_mean     = float(np.mean(speech_rms))
                energy_variance = float(np.var(speech_rms))
            else:
                energy_mean     = 0.0
                energy_variance = 0.0

            # --------------------------------------------------
            # STEP 7: Monotony score
            #
            # We normalize pitch_std to a 0-1 scale.
            # Reference values from speech research:
            # < 20Hz std = very monotone
            # > 80Hz std = very expressive
            # --------------------------------------------------
            monotony_score = min(pitch_std / 80.0, 1.0) if pitch_std > 0 else 0.0

            result = AcousticResult(
                wpm=wpm,
                pause_count=len(pauses),
                longest_pause_sec=round(longest_pause, 2),
                pause_list=pauses,
                silence_percentage=round(silence_pct, 1),
                pitch_mean=round(pitch_mean, 1),
                pitch_std=round(pitch_std, 1),
                energy_mean=round(energy_mean, 6),
                energy_variance=round(energy_variance, 8),
                speaking_duration_secs=round(speaking_duration, 1),
                total_duration_secs=round(total_duration, 1),
                monotony_score=round(monotony_score, 2)
            )

            logger.info(
                f"[AcousticService] Done — "
                f"WPM: {wpm:.0f}, "
                f"Pauses: {len(pauses)}, "
                f"Longest: {longest_pause:.1f}s, "
                f"Pitch std: {pitch_std:.1f}Hz, "
                f"Monotony: {monotony_score:.2f}"
            )

            return result

        except Exception as e:
            logger.error(
                f"[AcousticService] Analysis failed for "
                f"{audio_path}: {type(e).__name__}: {e}"
            )
            return None

    def analyze_from_bytes(
        self,
        audio_bytes: bytes,
        word_count: int = 0
    ) -> Optional[AcousticResult]:
        """
        Analyze from raw bytes (used when audio comes from upload).
        Same pattern as WhisperService.transcribe_from_bytes().
        """
        with tempfile.NamedTemporaryFile(
            suffix="_recording.webm",
            delete=False
        ) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            return self.analyze(tmp_path, word_count=word_count)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# Module-level singleton — one instance, reused everywhere
acoustic_service = AcousticService()