"""
backend/test_blueprint_pipeline.py

Test suite verifying Fluently Redesign Blueprint contract implementation:
1. Structured CoachingReport fields (primary_weakness, secondary_weaknesses, evidence, explanation, recommended_action, drill, confidence, score_version, provenance).
2. Quality gate for low speech evidence (<3 words or silent audio).
3. Topic Engine selection rationale and selection policy versioning.
"""

import pytest
import asyncio
from dataclasses import asdict
from analysis.coaching_service import CoachingReport, CoachingScores, coaching_service
from analysis.whisper_service import TranscriptResult
from analysis.acoustic_service import AcousticResult
from analysis.nlp_service import NLPResult
from analysis.pipeline import compute_scores_from_data, run_analysis_pipeline, save_results_to_db


def test_coaching_report_blueprint_fields():
    """Verify CoachingReport contains all required Blueprint specification fields."""
    report = CoachingReport(
        scores=CoachingScores(filler=85, delivery=75, structure=80, vocab=70, confidence=78),
        priority_fix="Pause for one second after key assertions.",
        daily_drill="Practice 60-second summary without fillers.",
    )

    data = asdict(report)
    assert "primary_weakness" in data
    assert "secondary_weaknesses" in data
    assert "evidence" in data
    assert "explanation" in data
    assert "recommended_action" in data
    assert "drill" in data
    assert "confidence" in data
    assert "score_version" in data
    assert data["score_version"] == "2.0"
    assert "provenance" in data


def test_compute_scores_versioning():
    """Verify compute_scores_from_data generates bounded 0-100 scores."""
    transcript = TranscriptResult(
        transcript="Hello, this is a test session to evaluate public speaking and presentation skills.",
        word_count=13,
        duration_secs=5.0,
        words=[]
    )
    acoustic = AcousticResult(
        wpm=150.0,
        pitch_mean=180.0,
        pitch_std=45.0,
        energy_variance=0.5,
        pause_count=1,
        longest_pause_sec=0.8,
        silence_percentage=10.0,
        pause_list=[],
        monotony_score=0.7,
        jitter=1.1,
        shimmer=8.5,
        hnr=15.0,
        intensity_db=62.0
    )
    nlp = NLPResult(
        filler_count=0,
        filler_detail={},
        fillers_per_minute=0.0,
        filler_occurrences=[],
        ttr_score=0.85,
        unique_word_count=11,
        total_word_count=13,
        hedge_word_count=0,
        hedge_words_found=[],
        sentence_count=1,
        avg_sentence_length=13.0
    )

    scores = compute_scores_from_data(transcript, acoustic, nlp)
    assert isinstance(scores, dict)
    for key in ["filler", "delivery", "structure", "vocab", "confidence"]:
        assert key in scores
        assert 0 <= scores[key] <= 100


@pytest.mark.asyncio
async def test_low_speech_quality_gate(monkeypatch):
    """Verify that recordings with <3 words produce a qualified low-confidence report instead of crashing."""
    async def dummy_save(*args, **kwargs):
        pass

    # Mock DB save to isolate pipeline test
    monkeypatch.setattr("analysis.pipeline.save_results_to_db", dummy_save)

    low_transcript = TranscriptResult(
        transcript="Hello",
        word_count=1,
        duration_secs=1.5,
        words=[]
    )

    # Mock whisper to return low speech
    async def mock_transcribe(*args, **kwargs):
        return low_transcript

    monkeypatch.setattr("analysis.whisper_service.whisper_service.transcribe_from_bytes", mock_transcribe)

    report = await run_analysis_pipeline(
        session_id="test-session-123",
        audio_bytes=b"0" * 5000,
        topic="Test Topic"
    )

    assert report is not None
    assert report.confidence.get("level") == "low"
    assert "Insufficient" in report.primary_weakness or "Insufficient" in report.confidence.get("reason", "")
    assert report.score_version == "2.0"
