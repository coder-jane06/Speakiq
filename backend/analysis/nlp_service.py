# =============================================================
# backend/analysis/nlp_service.py
#
# WHAT THIS FILE DOES:
#   Takes a transcript string → runs NLP analysis →
#   returns filler words, vocabulary score, hedge words,
#   sentence structure, and idea coverage
#
# WHAT YOU LEARN HERE:
#   - What NLP (Natural Language Processing) actually is
#   - How spaCy tokenizes and tags text
#   - Set operations in Python (fast membership checks)
#   - The Type-Token Ratio (a real linguistic metric)
#   - Why we separate concerns into small focused functions
#
# WHY THIS MATTERS:
#   The transcript tells us WHAT was said.
#   Acoustic analysis tells us HOW it sounded.
#   NLP tells us the QUALITY of the language used.
#   A speaker can sound confident but use weak language.
#   NLP catches that.
# =============================================================

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# -------------------------------------------------------------
# FILLER WORDS
#
# These are words/phrases that speakers use as verbal crutches
# when they're thinking or nervous. They add no meaning.
#
# WHY A SET not a list:
# Python sets use hash tables for lookup.
# Checking "basically" in FILLER_WORDS takes O(1) time — 
# it's instant regardless of how many fillers are in the set.
# A list would check every item one by one — O(n).
# For text analysis running on thousands of words, this matters.
# -------------------------------------------------------------
FILLER_WORDS = {
    # Hesitation sounds
    "um", "uh", "er", "ah", "hmm",

    # Verbal crutches
    "like", "basically", "literally", "actually", "honestly",
    "seriously", "clearly", "obviously", "simply",

    # Thinking phrases
    "you know", "i mean", "you see", "you get me",
    "know what i mean", "you know what i mean",

    # Hedging (weaken your message — treated as fillers here)
    "kind of", "sort of", "kinda", "sorta",

    # Filler transitions
    "right", "okay so", "so yeah", "and so", "so basically",
    "at the end of the day", "the thing is",
}

# -------------------------------------------------------------
# HEDGE WORDS
#
# Hedges are words that weaken your statements.
# "I think democracy is good" is weaker than "Democracy is good."
# "It might be important" is weaker than "It is important."
#
# Hedge words signal lack of confidence to the listener.
# Great speakers minimize hedges when making key points.
# -------------------------------------------------------------
HEDGE_WORDS = {
    "maybe", "perhaps", "possibly", "probably", "might",
    "could", "should", "i think", "i guess", "i suppose",
    "i believe", "i feel like", "it seems", "it appears",
    "kind of", "sort of", "somewhat", "rather", "fairly",
    "quite", "a bit", "a little",
}

# Phrases that indicate incomplete thoughts
INCOMPLETE_INDICATORS = {
    "anyway", "whatever", "etc", "and stuff", "or something",
    "or whatever", "and things like that",
}


# -------------------------------------------------------------
# OUTPUT DATACLASS
# -------------------------------------------------------------

@dataclass
class FillerOccurrence:
    """
    A single detected filler word with its position.
    Position lets us say "you said 'basically' at word 23"
    which maps back to a timestamp via the Whisper word list.
    """
    word: str           # the filler word found
    position: int       # which word number in the transcript


@dataclass
class NLPResult:
    """
    Complete linguistic analysis of a transcript.
    """

    # --- Filler analysis ---
    filler_count: int = 0
    # Total number of filler words detected

    filler_detail: dict = field(default_factory=dict)
    # Breakdown by word: {"basically": 4, "like": 7, "um": 2}
    # This tells us WHICH fillers to coach on specifically

    filler_occurrences: list[FillerOccurrence] = field(default_factory=list)
    # Every single occurrence with position
    # Used to highlight fillers in the transcript UI

    fillers_per_minute: float = 0.0
    # Normalized rate — comparable across sessions of different lengths

    # --- Vocabulary ---
    ttr_score: float = 0.0
    # Type-Token Ratio = unique_words / total_words
    # Measures vocabulary diversity.
    # 0.3 = very repetitive (using same words over and over)
    # 0.7 = very diverse vocabulary
    # Native speakers in conversation: typically 0.4-0.6

    unique_word_count: int = 0
    total_word_count: int = 0

    # --- Hedging ---
    hedge_word_count: int = 0
    hedge_words_found: list[str] = field(default_factory=list)
    # Which hedge words appeared — coaching can target these specifically

    # --- Sentence structure ---
    sentence_count: int = 0
    avg_sentence_length: float = 0.0
    # Short sentences (< 8 words avg) = fragmented, incomplete thoughts
    # Long sentences (> 25 words avg) = run-on, hard to follow
    # Sweet spot: 12-18 words average

    incomplete_sentence_count: int = 0
    # Sentences that trail off or end with fillers

    # --- Content quality ---
    top_words: list[str] = field(default_factory=list)
    # Most frequent content words (excluding stop words like "the", "is")
    # Reveals what topics the speaker actually covered

    word_count: int = 0


# -------------------------------------------------------------
# THE SERVICE CLASS
# -------------------------------------------------------------

class NLPService:
    """
    Performs linguistic analysis on speech transcripts.

    Loads the spaCy model ONCE when the class is created,
    then reuses it for every analysis. Loading a spaCy model
    takes ~0.5 seconds — doing it per-request would be slow.
    """

    def __init__(self):
        # Load the English language model.
        # en_core_web_sm is the small model — fast, good enough
        # for our use case. (sm = small, md = medium, lg = large)
        # The larger models are more accurate but slower.
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("[NLPService] spaCy model loaded: en_core_web_sm")
        except Exception as e:
            logger.error(f"[NLPService] Failed to load spaCy model: {e}")
            self.nlp = None

    def analyze(
        self,
        transcript: str,
        duration_secs: float = 60.0
    ) -> Optional[NLPResult]:
        """
        Analyze a transcript string.

        PARAMETERS:
            transcript:    the full text from Whisper
            duration_secs: recording length (for per-minute rates)

        NOTE: This is synchronous (no async) because spaCy's
        processing is CPU-bound. Called via run_in_threadpool
        from the FastAPI route.
        """

        if not transcript or not transcript.strip():
            logger.warning("[NLPService] Empty transcript received")
            return NLPResult()

        if self.nlp is None:
            logger.error("[NLPService] spaCy model not loaded")
            return None

        logger.info(f"[NLPService] Analyzing transcript ({len(transcript)} chars)")

        try:
            # --------------------------------------------------
            # STEP 1: Process with spaCy
            #
            # self.nlp(transcript) runs the full NLP pipeline:
            # - Tokenizer: splits text into individual tokens
            # - Tagger: assigns part-of-speech tags (noun/verb/etc)
            # - Parser: analyzes sentence structure
            # - NER: finds named entities (not used here)
            #
            # doc is a spaCy Doc object — a rich representation
            # of the text that we can query in many ways.
            # --------------------------------------------------
            import spacy
            doc = self.nlp(transcript.lower())

            # --------------------------------------------------
            # STEP 2: Detect filler words
            #
            # We check both single tokens AND multi-word phrases.
            # "you know" is two tokens but one filler.
            #
            # For multi-word fillers, we use a sliding window:
            # look at each pair/triple of consecutive words.
            # --------------------------------------------------
            filler_count       = 0
            filler_detail      = {}
            filler_occurrences = []

            # Get all tokens as a list for windowed access
            tokens = [token.text for token in doc]

            i = 0
            while i < len(tokens):
                found_filler = None
                found_length = 1

                # Check 3-word phrases first (longest match)
                if i + 2 < len(tokens):
                    three_gram = f"{tokens[i]} {tokens[i+1]} {tokens[i+2]}"
                    if three_gram in FILLER_WORDS:
                        found_filler = three_gram
                        found_length = 3

                # Check 2-word phrases
                if not found_filler and i + 1 < len(tokens):
                    two_gram = f"{tokens[i]} {tokens[i+1]}"
                    if two_gram in FILLER_WORDS:
                        found_filler = two_gram
                        found_length = 2

                # Check single word
                if not found_filler:
                    if tokens[i] in FILLER_WORDS:
                        found_filler = tokens[i]
                        found_length = 1

                if found_filler:
                    filler_count += 1
                    filler_detail[found_filler] = filler_detail.get(found_filler, 0) + 1
                    filler_occurrences.append(FillerOccurrence(
                        word=found_filler,
                        position=i
                    ))
                    i += found_length  # skip past the whole phrase
                else:
                    i += 1

            # Fillers per minute
            duration_mins   = duration_secs / 60.0
            fillers_per_min = round(filler_count / duration_mins, 1) if duration_mins > 0 else 0

            # --------------------------------------------------
            # STEP 3: Vocabulary diversity (Type-Token Ratio)
            #
            # We calculate TTR on CONTENT words only.
            # Stop words like "the", "is", "a", "and" are excluded
            # because every speaker uses them equally.
            # We want to measure vocabulary richness, not grammar.
            #
            # token.is_stop  = True for "the", "is", "a", etc.
            # token.is_punct = True for ".", ",", "!" etc.
            # token.is_space = True for whitespace tokens
            # token.lemma_  = base form: "speaking" → "speak"
            # --------------------------------------------------
            content_tokens = [
                token.lemma_
                for token in doc
                if not token.is_stop
                and not token.is_punct
                and not token.is_space
                and len(token.text) > 1
            ]

            total_word_count  = len(content_tokens)
            unique_word_count = len(set(content_tokens))
            ttr_score = round(unique_word_count / total_word_count, 3) \
                        if total_word_count > 0 else 0.0

            # --------------------------------------------------
            # STEP 4: Hedge word detection
            # Same sliding window approach as fillers
            # --------------------------------------------------
            hedge_count      = 0
            hedge_words_found = []

            j = 0
            while j < len(tokens):
                found_hedge  = None
                found_length = 1

                if j + 1 < len(tokens):
                    two_gram = f"{tokens[j]} {tokens[j+1]}"
                    if two_gram in HEDGE_WORDS:
                        found_hedge  = two_gram
                        found_length = 2

                if not found_hedge and tokens[j] in HEDGE_WORDS:
                    found_hedge  = tokens[j]
                    found_length = 1

                if found_hedge:
                    hedge_count += 1
                    if found_hedge not in hedge_words_found:
                        hedge_words_found.append(found_hedge)
                    j += found_length
                else:
                    j += 1

            # --------------------------------------------------
            # STEP 5: Sentence analysis
            #
            # spaCy automatically detects sentence boundaries.
            # doc.sents is a generator of sentence spans.
            # --------------------------------------------------
            sentences          = list(doc.sents)
            sentence_count     = len(sentences)
            sentence_lengths   = [len([t for t in s if not t.is_punct and not t.is_space])
                                   for s in sentences]
            avg_sentence_length = round(
                sum(sentence_lengths) / len(sentence_lengths), 1
            ) if sentence_lengths else 0.0

            # Detect incomplete sentences
            # A sentence ending with a filler or trailing off
            incomplete_count = 0
            for sent in sentences:
                sent_text = sent.text.strip().lower()
                for indicator in INCOMPLETE_INDICATORS:
                    if sent_text.endswith(indicator):
                        incomplete_count += 1
                        break

            # --------------------------------------------------
            # STEP 6: Top content words
            # Most frequent content words reveal topic coverage.
            # Counter from collections counts occurrences.
            # --------------------------------------------------
            from collections import Counter
            word_freq  = Counter(content_tokens)
            # most_common(8) = top 8 most frequent words
            top_words  = [word for word, _ in word_freq.most_common(8)]

            result = NLPResult(
                filler_count=filler_count,
                filler_detail=filler_detail,
                filler_occurrences=filler_occurrences,
                fillers_per_minute=fillers_per_min,
                ttr_score=ttr_score,
                unique_word_count=unique_word_count,
                total_word_count=total_word_count,
                hedge_word_count=hedge_count,
                hedge_words_found=hedge_words_found,
                sentence_count=sentence_count,
                avg_sentence_length=avg_sentence_length,
                incomplete_sentence_count=incomplete_count,
                top_words=top_words,
                word_count=len(tokens)
            )

            logger.info(
                f"[NLPService] Done — "
                f"Fillers: {filler_count} ({fillers_per_min}/min), "
                f"TTR: {ttr_score:.2f}, "
                f"Hedges: {hedge_count}, "
                f"Sentences: {sentence_count}"
            )

            return result

        except Exception as e:
            logger.error(
                f"[NLPService] Analysis failed: {type(e).__name__}: {e}"
            )
            return None


# Module-level singleton
nlp_service = NLPService()