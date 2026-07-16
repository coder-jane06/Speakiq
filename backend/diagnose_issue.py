"""
Diagnostic script to test the analysis pipeline with a test audio file.
This will help identify where the zero-score problem is occurring.
"""
import asyncio
import sys
import logging
import os
from pathlib import Path

# Setup logging to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

async def test_full_pipeline():
    """Test the complete analysis pipeline with a test audio file."""

    logger.info("=" * 60)
    logger.info("FLUENTLY DIAGNOSTIC TEST")
    logger.info("=" * 60)

    # Step 1: Check if test audio exists
    test_audio_path = Path("test_audio_real.webm")
    if not test_audio_path.exists():
        logger.error(f"❌ Test audio file not found: {test_audio_path}")
        logger.info("Run: python create_test_audio.py")
        return False

    logger.info(f"✅ Test audio file found: {test_audio_path} ({test_audio_path.stat().st_size} bytes)")

    # Step 2: Load audio bytes
    with open(test_audio_path, 'rb') as f:
        audio_bytes = f.read()
    logger.info(f"✅ Audio loaded: {len(audio_bytes)} bytes")

    # Step 3: Test Whisper transcription
    logger.info("\n" + "=" * 60)
    logger.info("STEP 1: Testing Whisper Transcription")
    logger.info("=" * 60)
    try:
        from analysis.whisper_service import whisper_service
        transcript_result = await whisper_service.transcribe_from_bytes(
            audio_bytes=audio_bytes,
            filename="test_recording.webm"
        )

        if transcript_result:
            logger.info(f"✅ Transcription successful!")
            logger.info(f"   - Transcript: {transcript_result.transcript[:200]}...")
            logger.info(f"   - Word count: {transcript_result.word_count}")
            logger.info(f"   - Duration: {transcript_result.duration_secs:.1f}s")
            logger.info(f"   - Words with timestamps: {len(transcript_result.words)}")
        else:
            logger.error("❌ Transcription returned None")
            return False
    except Exception as e:
        logger.error(f"❌ Whisper transcription failed: {e}", exc_info=True)
        return False

    # Step 4: Test Acoustic Analysis
    logger.info("\n" + "=" * 60)
    logger.info("STEP 2: Testing Acoustic Analysis")
    logger.info("=" * 60)
    try:
        from analysis.acoustic_service import acoustic_service
        acoustic_result = acoustic_service.analyze_from_bytes(
            audio_bytes=audio_bytes,
            word_count=transcript_result.word_count
        )

        if acoustic_result:
            logger.info(f"✅ Acoustic analysis successful!")
            logger.info(f"   - WPM: {acoustic_result.wpm:.1f}")
            logger.info(f"   - Pauses: {acoustic_result.pause_count}")
            logger.info(f"   - Longest pause: {acoustic_result.longest_pause_sec:.1f}s")
            logger.info(f"   - Pitch std: {acoustic_result.pitch_std:.1f}Hz")
            logger.info(f"   - Silence: {acoustic_result.silence_percentage:.1f}%")
        else:
            logger.error("❌ Acoustic analysis returned None")
            return False
    except Exception as e:
        logger.error(f"❌ Acoustic analysis failed: {e}", exc_info=True)
        return False

    # Step 5: Test NLP Analysis
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3: Testing NLP Analysis")
    logger.info("=" * 60)
    try:
        from analysis.nlp_service import nlp_service
        nlp_result = nlp_service.analyze(
            transcript=transcript_result.transcript,
            duration_secs=transcript_result.duration_secs
        )

        if nlp_result:
            logger.info(f"✅ NLP analysis successful!")
            logger.info(f"   - Filler count: {nlp_result.filler_count} ({nlp_result.fillers_per_minute}/min)")
            logger.info(f"   - Filler breakdown: {nlp_result.filler_detail}")
            logger.info(f"   - TTR score: {nlp_result.ttr_score:.2f}")
            logger.info(f"   - Hedge words: {nlp_result.hedge_word_count}")
            logger.info(f"   - Sentences: {nlp_result.sentence_count}")
        else:
            logger.error("❌ NLP analysis returned None")
            return False
    except Exception as e:
        logger.error(f"❌ NLP analysis failed: {e}", exc_info=True)
        return False

    # Step 6: Test Scoring Algorithm
    logger.info("\n" + "=" * 60)
    logger.info("STEP 4: Testing Scoring Algorithm")
    logger.info("=" * 60)
    try:
        from analysis.pipeline import compute_scores_from_data

        scores = compute_scores_from_data(
            transcript=transcript_result,
            acoustic=acoustic_result,
            nlp=nlp_result,
            speaking_goal="general",
            difficulty_tier="beginner",
            session_history=None
        )

        logger.info(f"✅ Scoring successful!")
        logger.info(f"   - Filler score: {scores['filler']}/100")
        logger.info(f"   - Delivery score: {scores['delivery']}/100")
        logger.info(f"   - Structure score: {scores['structure']}/100")
        logger.info(f"   - Vocab score: {scores['vocab']}/100")
        logger.info(f"   - Confidence score: {scores['confidence']}/100")

        # Check for zero scores
        zero_scores = [k for k, v in scores.items() if v == 0]
        if zero_scores:
            logger.warning(f"⚠️  Warning: Zero scores detected for: {zero_scores}")
        else:
            logger.info("✅ All scores are non-zero!")

    except Exception as e:
        logger.error(f"❌ Scoring algorithm failed: {e}", exc_info=True)
        return False

    # Step 7: Test Coaching Service
    logger.info("\n" + "=" * 60)
    logger.info("STEP 5: Testing Coaching Service")
    logger.info("=" * 60)
    try:
        from analysis.coaching_service import coaching_service

        coaching_report = await coaching_service.generate_report(
            topic="Test diagnostic session",
            transcript_result=transcript_result,
            acoustic_result=acoustic_result,
            nlp_result=nlp_result,
            user_profile=None,
            session_number=1,
            pre_computed_scores=scores,
            session_history=None,
            speaking_goal="general"
        )

        if coaching_report:
            logger.info(f"✅ Coaching report generated!")
            logger.info(f"   - Scores: {coaching_report.scores.__dict__}")
            logger.info(f"   - What went well: {coaching_report.what_went_well[:100]}...")
            logger.info(f"   - Priority fix: {coaching_report.priority_fix[:100]}...")
        else:
            logger.error("❌ Coaching report returned None")
            return False
    except Exception as e:
        logger.error(f"❌ Coaching service failed: {e}", exc_info=True)
        return False

    # Final Summary
    logger.info("\n" + "=" * 60)
    logger.info("DIAGNOSTIC COMPLETE")
    logger.info("=" * 60)
    logger.info("✅ All pipeline components are working!")
    logger.info(f"\nFinal Scores:")
    logger.info(f"  Filler:     {coaching_report.scores.filler}/100")
    logger.info(f"  Delivery:   {coaching_report.scores.delivery}/100")
    logger.info(f"  Structure:  {coaching_report.scores.structure}/100")
    logger.info(f"  Vocab:      {coaching_report.scores.vocab}/100")
    logger.info(f"  Confidence: {coaching_report.scores.confidence}/100")

    avg_score = (
        coaching_report.scores.filler +
        coaching_report.scores.delivery +
        coaching_report.scores.structure +
        coaching_report.scores.vocab +
        coaching_report.scores.confidence
    ) / 5
    logger.info(f"\n  OVERALL:    {avg_score:.0f}/100")

    return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_full_pipeline())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        logger.info("\nDiagnostic interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Diagnostic failed with unexpected error: {e}", exc_info=True)
        sys.exit(1)
