from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class WordEntry:
    word: str
    start: float
    end: float

@dataclass
class FillerOccurrence:
    word: str
    count: int
    timestamps: List[float]

@dataclass
class SilenceGap:
    start: float
    end: float
    duration: float

@dataclass
class SpeechAnalysis:
    # From faster-whisper
    transcript: str
    words: List[WordEntry]
    duration_seconds: float

    # From Librosa
    words_per_minute: float
    avg_pitch_hz: float
    pitch_variance: float
    tremor_score: float

    # From spaCy
    filler_words: List[FillerOccurrence]
    hedge_words: List[FillerOccurrence]
    sentences: List[str]
    type_token_ratio: float

    # From pipeline
    silence_gaps: List[SilenceGap]
    worst_window: Dict[str, Any]
    topic: str
    user_goal: str
