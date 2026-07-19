"""Sessions router — with security fixes and rate limiting."""
import logging
import random
import uuid
import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Header, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from auth import get_current_user
from config import get_db
from routers.utils import get_user_id_from_token

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/webm;codecs=opus", "audio/webm;codecs=vp8",
    "audio/mp4", "audio/wav", "audio/mpeg", "audio/ogg", "application/octet-stream"
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

def normalize_goal_local(goal: Optional[str]) -> str:
    if not goal:
        return "general"
    g = goal.lower().strip()
    valid_goals = {"orator", "debater", "presenter", "interviewer", "general"}
    return g if g in valid_goals else "general"

def normalize_difficulty_local(diff: Optional[str]) -> str:
    if not diff:
        return "medium"
    d = diff.lower().strip()
    mapping = {"beginner": "easy", "easy": "easy", "medium": "medium", "hard": "hard", "advanced": "hard"}
    return mapping.get(d, "medium")

def generate_topic_pool():
    pool = {g: {t: [] for t in ["easy", "medium", "hard"]} for g in ["orator", "debater", "presenter", "interviewer", "general"]}
    
    # ---------------- Orator ----------------
    orator_easy_events = ["moment", "decision", "mistake", "conversation", "journey", "failure", "success", "challenge", "discovery", "risk", "opportunity"]
    orator_easy_actions = ["adapt quickly", "stand your ground", "ask for help", "lead a group", "step out of your comfort zone", "overcome a fear", "make a sacrifice", "learn a hard truth", "forgive someone", "start over"]
    orator_easy_subjects = ["a childhood memory", "a mentor", "a difficult friendship", "a passion project", "an unexpected turn of events", "a creative block", "a moment of doubt", "a leap of faith", "a happy coincidence", "a personal milestone"]
    orator_easy_concepts = ["patience", "resilience", "honesty", "courage", "empathy", "gratitude", "discipline", "curiosity", "kindness", "humility"]
    pool["orator"]["easy"] = [f"Talk about a {e} that changed your perspective." for e in orator_easy_events] + \
                             [f"Describe a time when you had to {a}." for a in orator_easy_actions] + \
                             [f"Share a story about {s} and what it taught you." for s in orator_easy_subjects] + \
                             [f"Explain the importance of {c} in your life." for c in orator_easy_concepts]

    orator_medium_concepts = ["vulnerability", "teamwork", "creative thinking", "financial independence", "minimalism", "digital detox", "lifelong learning", "public speaking", "critical thinking", "emotional intelligence"]
    orator_medium_contexts = ["the modern workplace", "personal development", "building relationships", "achieving goals", "overcoming adversity", "educational settings", "community building", "global communication", "leadership roles", "daily life"]
    orator_medium_ideas = ["failure is a stepping stone", "perfect is the enemy of good", "soft skills are hard skills", "we need more boredom", "social media divides us", "routine sets you free", "generalists beat specialists", "passion is overrated", "silence is powerful", "small habits compound"]
    orator_medium_goals = ["career growth", "mental well-being", "societal progress", "innovation", "sustainability", "effective leadership", "personal fulfillment", "conflict resolution", "building trust", "fostering creativity"]
    pool["orator"]["medium"] = [f"Deliver a 3-minute speech on the value of {c} in {ctx}." for c in orator_medium_concepts for ctx in orator_medium_contexts[:4]] + \
                               [f"Persuade your audience that {i} is essential for {g}." for i in orator_medium_ideas for g in orator_medium_goals[:3]]

    orator_hard_events = ["climate action summit", "global technology conference", "university graduation ceremony", "international peace forum", "startup pitching finale", "human rights convention", "medical innovation symposium", "educational reform panel", "space exploration gala", "economic recovery summit", "AI ethics roundtable"]
    orator_hard_concepts = ["privacy", "the traditional 9-to-5", "the concept of truth", "the American Dream", "meritocracy", "the sharing economy", "fast fashion", "the anonymity of the internet", "perfectionism", "the age of influencers"]
    orator_hard_ideas = ["technology has outpaced our morality", "universal basic income is inevitable", "we should abolish grades in schools", "space colonization is a waste of resources", "the attention economy is destroying art", "national borders will become obsolete", "we have lost the ability to debate", "algorithms rule our lives", "convenience is making us fragile", "extreme wealth is a policy failure"]
    pool["orator"]["hard"] = [f"Deliver a 90-second keynote-style opening for a {e}." for e in orator_hard_events] + \
                             [f"Give an impromptu eulogy for {c}." for c in orator_hard_concepts] + \
                             [f"Defend the controversial idea that {i}." for i in orator_hard_ideas] * 2

    # ---------------- Debater ----------------
    debater_easy_entities = ["schools", "corporations", "governments", "parents", "social media platforms", "employers", "universities", "cities", "hospitals", "police"]
    debater_easy_actions = ["have a dress code", "monitor employee emails", "ban junk food", "track user locations", "enforce strict working hours", "require mandatory volunteering", "censor hate speech", "ban smartphones", "mandate vaccines", "restrict free speech"]
    debater_easy_concept1 = ["remote work", "books", "public transport", "capitalism", "movies", "introversion", "saving money", "street smarts", "logic", "talent"]
    debater_easy_concept2 = ["office work", "podcasts", "driving", "socialism", "video games", "extroversion", "investing money", "book smarts", "emotion", "hard work"]
    pool["debater"]["easy"] = [f"Should {e} be allowed to {a}?" for e, a in zip(debater_easy_entities, debater_easy_actions)] * 2 + \
                              [f"Is {c1} better than {c2}?" for c1, c2 in zip(debater_easy_concept1, debater_easy_concept2)] * 2

    debater_medium_policies = ["a 4-day work week", "universal healthcare", "a carbon tax", "free higher education", "banning plastic bags", "mandatory military service", "a universal basic income", "stricter gun control", "legalizing all drugs", "taxing robots"]
    debater_medium_tech = ["facial recognition", "autonomous weapons", "gene editing", "deepfakes", "cryptocurrency", "social media algorithms", "data mining", "brain-computer interfaces", "lab-grown meat", "drone surveillance"]
    pool["debater"]["medium"] = [f"Argue for or against the implementation of {p}." for p in debater_medium_policies] * 2 + \
                                [f"Debate the ethical implications of {t}." for t in debater_medium_tech] * 2

    debater_hard_complex = ["Algorithmic content curation does more societal harm than good", "The benefits of globalization have primarily accrued to the elite", "A benevolent dictatorship is more effective than a divided democracy", "The pursuit of infinite economic growth is fundamentally incompatible with ecological survival", "Humanity is not prepared for the consequences of artificial general intelligence", "The current patent system stifles innovation rather than protecting it", "Social media has fundamentally broken the democratic process", "Space exploration is an unethical use of capital given terrestrial suffering", "Censorship is occasionally necessary for the preservation of a tolerant society", "The nation-state is an obsolete construct in a hyper-connected world"]
    debater_hard_claims = ["privacy is a fundamental human right that supersedes security", "we have a moral obligation to intervene in foreign conflicts", "art generated by AI has no intrinsic value", "the stock market is disconnected from the real economy", "objective truth does not exist in politics", "the internet should be regulated as a public utility", "we are living in a simulation", "punitive justice should be entirely replaced by restorative justice", "animal testing is never justified", "history is driven by great individuals rather than societal forces"]
    pool["debater"]["hard"] = [f"Resolved: {c} — refute the proposition with evidence-based arguments." for c in debater_hard_complex] * 2 + \
                              [f"Construct a compelling counter-argument to the claim that {c}." for c in debater_hard_claims] * 2

    # ---------------- Presenter ----------------
    presenter_easy_concepts = ["what you do for work", "your favorite hobby", "a basic recipe", "how to tie a tie", "the rules of a sport", "your morning routine", "how a car engine works", "the plot of a movie", "how to use a smartphone app", "your weekend plans"]
    presenter_easy_projects = ["the new marketing campaign", "the office renovation", "the upcoming software release", "the team restructuring", "the quarterly sales targets", "the annual budget", "the new hiring process", "the customer feedback survey", "the sustainability initiative", "the health and safety audit"]
    pool["presenter"]["easy"] = [f"Explain {c} to someone outside your industry." for c in presenter_easy_concepts] * 2 + \
                                [f"Give a quick update on {p}." for p in presenter_easy_projects] * 2

    presenter_medium_initiatives = ["a flexible work policy", "a new training program", "a company-wide hackathon", "a wellness stipend", "a mentorship program", "a diversity and inclusion task force", "a shift to agile methodology", "a cloud migration strategy", "a customer loyalty program", "a rebranding effort"]
    presenter_medium_reports = ["the Q3 financial results", "the annual user demographics study", "the employee engagement survey", "the competitor analysis", "the market research on Gen Z", "the cybersecurity risk assessment", "the environmental impact study", "the post-mortem on the recent outage", "the beta testing feedback", "the sales forecast for next year"]
    pool["presenter"]["medium"] = [f"Present a proposal for {i}." for i in presenter_medium_initiatives] * 2 + \
                                  [f"Summarize the findings of {r}." for r in presenter_medium_reports] * 2

    presenter_hard_actions = ["a 30% budget increase", "a complete pivot in product strategy", "laying off 10% of the workforce", "acquiring a failing competitor", "delaying the flagship product launch by 6 months", "switching to a subscription model", "open-sourcing proprietary software", "withdrawing from a major market", "implementing an AI-first approach", "doubling the price of the core service"]
    presenter_hard_audiences = ["a skeptical CFO", "an angry board of directors", "a hostile press corps", "a group of striking employees", "a confused regulatory committee", "a panel of uncompromising investors", "a disillusioned customer base", "a highly technical engineering team", "a risk-averse legal department", "a demanding group of stakeholders"]
    presenter_hard_products = ["a quantum computing infrastructure", "a decentralized autonomous organization", "a novel gene therapy", "a fully autonomous logistics network", "a predictive policing algorithm", "a hyperloop transportation system", "a commercial fusion reactor", "a brain-machine interface", "a synthetic meat production facility", "an AI-driven legal defense system"]
    presenter_hard_investors = ["a conservative venture capitalist", "a visionary angel investor", "a government grant committee", "a private equity firm", "a crowdfunding audience", "a philanthropic foundation", "a corporate incubator", "a sovereign wealth fund", "a syndicate of industry veterans", "a highly skeptical retail investor"]
    pool["presenter"]["hard"] = [f"Present a data-driven case for {a} to a {au}." for a, au in zip(presenter_hard_actions, presenter_hard_audiences)] * 2 + \
                                [f"Pitch a complex {p} to {i} in 2 minutes." for p, i in zip(presenter_hard_products, presenter_hard_investors)] * 2

    # ---------------- Interviewer ----------------
    int_easy_roles = ["project manager", "software engineer", "marketing specialist", "sales representative", "data analyst", "customer support agent", "graphic designer", "financial advisor", "HR coordinator", "operations manager"]
    int_easy_traits = ["strength", "weakness", "accomplishment", "regret", "inspiration", "pet peeve", "fear", "motivation", "talent", "quirk"]
    pool["interviewer"]["easy"] = [f"Tell me about yourself as if applying for a {r} role." for r in int_easy_roles] * 2 + \
                                  [f"What is your biggest {t} and why?" for t in int_easy_traits] * 2

    int_medium_actions = ["failed to meet a deadline", "disagreed with a manager", "had to learn a new skill quickly", "dealt with a difficult coworker", "exceeded expectations", "had to pivot on a project", "received negative feedback", "took the lead without being asked", "solved a complex problem", "had to compromise"]
    int_medium_situations = ["a sudden change in scope", "a team member not pulling their weight", "a miscommunication with a client", "a lack of clear direction", "a high-pressure deadline", "a conflict of interest", "a situation where you were wrong", "a technical failure", "a moral dilemma", "a budget cut"]
    pool["interviewer"]["medium"] = [f"Walk me through a time you {a} at work." for a in int_medium_actions] * 2 + \
                                    [f"How do you handle {s}?" for s in int_medium_situations] * 2

    int_hard_issues = ["a critical system failure", "a PR crisis", "a legal dispute", "a major product flaw", "a sudden loss of funding", "a security breach", "a massive shift in market demand", "a highly sensitive personnel issue", "a supply chain collapse", "a disruptive technological shift"]
    int_hard_problems = ["scaling a platform to millions of users", "reducing carbon emissions across a global supply chain", "ensuring data privacy in a decentralized network", "automating a complex creative process", "optimizing resource allocation in a hospital", "predicting consumer behavior in a volatile market", "mitigating bias in an AI recruitment tool", "securing a national power grid", "designing an accessible voting system", "managing traffic flow in a megacity"]
    pool["interviewer"]["hard"] = [f"Walk me through a time you had to make a high-stakes decision about {i} with incomplete data under pressure." for i in int_hard_issues] * 2 + \
                                  [f"How would you design a system for {p}?" for p in int_hard_problems] * 2

    # ---------------- General ----------------
    gen_easy_topics = ["climate change", "mental health", "personal finance", "nutrition", "history", "coding", "geography", "first aid", "media literacy", "communication skills"]
    gen_easy_things = ["vacation", "workspace", "weekend", "morning routine", "meal", "book", "movie", "friend", "colleague", "home"]
    pool["general"]["easy"] = [f"What is one thing you wish more people knew about {t}?" for t in gen_easy_topics] * 2 + \
                              [f"Describe your ideal {t}." for t in gen_easy_things] * 2

    gen_medium_systems = ["the education system", "the healthcare system", "the voting process", "public transportation", "the tax code", "the criminal justice system", "the immigration process", "the patent system", "the academic publishing model", "the recycling system"]
    gen_medium_trends = ["remote work", "artificial intelligence", "the gig economy", "influencer culture", "minimalism", "fast fashion", "subscription services", "plant-based diets", "cryptocurrency", "cancel culture"]
    pool["general"]["medium"] = [f"How would you improve {s}?" for s in gen_medium_systems] * 2 + \
                                [f"What are the pros and cons of {t}?" for t in gen_medium_trends] * 2

    gen_hard_subjects = ["the definition of success", "the necessity of conflict", "the value of art", "the morality of wealth", "the illusion of free will", "the inevitability of suffering", "the purpose of education", "the limits of logic", "the nature of happiness", "the danger of empathy"]
    gen_hard_phenomena = ["the automation of labor", "the decline of organized religion", "the rise of nationalism", "the fragmentation of media", "the aging global population", "the colonization of space", "the commercialization of childhood", "the erosion of privacy", "the democratization of information", "the acceleration of technological change"]
    pool["general"]["hard"] = [f"Argue for a counterintuitive position on {s}." for s in gen_hard_subjects] * 2 + \
                              [f"Explain the long-term societal impact of {p}." for p in gen_hard_phenomena] * 2

    return pool

TOPIC_POOL = generate_topic_pool()

@router.get("/topic")
@limiter.limit("30/minute")
async def get_topic(
    request: Request,
    authorization: Optional[str] = Header(None),
    exclude: Optional[str] = None,
    exclude_texts: Optional[str] = None,
    goal: Optional[str] = None,
    difficulty: Optional[str] = None,
):
    db = get_db()
    user_id = get_user_id_from_token(authorization)
    speaking_goal = normalize_goal_local(goal) if goal else "general"
    weakest_skill = "general"
    diff_tier = normalize_difficulty_local(difficulty) if difficulty else "medium"
    recent_topic_texts = []

    if user_id:
        try:
            profile = (
                db.table("user_profiles")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if profile.data:
                p = profile.data[0]
                if not goal:
                    speaking_goal = normalize_goal_local(p.get("speaking_goal"))
                if not difficulty:
                    diff_tier = normalize_difficulty_local(p.get("difficulty_tier"))

                skill_scores = {
                    "structure": p.get("structure_score", 50),
                    "vocab": p.get("vocab_score", 50),
                    "delivery": p.get("delivery_score", 50),
                    "confidence": p.get("confidence_score", 50),
                }
                weakest_skill = min(skill_scores, key=skill_scores.get)

            recent = (
                db.table("sessions")
                .select("topic_text")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            recent_topic_texts = [
                r["topic_text"]
                for r in (recent.data or [])
                if r.get("topic_text")
            ]
        except Exception as e:
            logger.warning(f"[sessions] Topic personalization skipped: {e}")

    try:
        query = db.table("topics").select("id, text, tier, target_skill, category, goal_type")
        if speaking_goal != "general":
            query = query.in_("goal_type", [speaking_goal, "general"])
        result = query.limit(50).execute()

        if result.data:
            candidates = [t for t in result.data if t.get("text")]

            if exclude:
                filtered_candidates = [t for t in candidates if str(t.get("id")) != exclude]
                if filtered_candidates:
                    candidates = filtered_candidates

            if exclude_texts:
                ex_texts = [x.strip() for x in exclude_texts.split(",") if x.strip()]
                filtered_candidates = [t for t in candidates if t["text"] not in ex_texts]
                if filtered_candidates:
                    candidates = filtered_candidates

            unseen = [t for t in candidates if t["text"] not in recent_topic_texts]
            if unseen:
                candidates = unseen

            skill_matched = [t for t in candidates if t.get("target_skill") == weakest_skill]
            if skill_matched:
                candidates = skill_matched

            tier_matched = [t for t in candidates if t.get("tier") == diff_tier]
            if tier_matched:
                candidates = tier_matched

            chosen = random.choice(candidates)
            topic_tier = chosen.get("tier", "medium")
            return {
                "id": chosen.get("id", "topic"),
                "text": chosen["text"],
                "tier": topic_tier,
                "difficulty": topic_tier,
                "target_skill": chosen.get("target_skill", "general"),
                "category": chosen.get("category", "opinion"),
                "goal_type": chosen.get("goal_type", "general"),
            }
    except Exception as e:
        logger.warning(f"[sessions] Supabase topic query failed: {e}")

    # Fallback to TOPIC_POOL
    goal_type = speaking_goal
    if goal_type not in TOPIC_POOL:
        goal_type = "general"
        
    tier = diff_tier
    if tier not in ["easy", "medium", "hard"]:
        tier = "medium"
    
    excluded_set = set(recent_topic_texts)
    if exclude_texts:
        excluded_set.update(x.strip() for x in exclude_texts.split(",") if x.strip())
        
    def get_candidates_from_pool(g_type, t_tier):
        if g_type not in TOPIC_POOL or t_tier not in TOPIC_POOL[g_type]:
            return []
        pool = TOPIC_POOL[g_type][t_tier]
        return [text for text in pool if text not in excluded_set]
        
    candidates = get_candidates_from_pool(goal_type, tier)
    if not candidates:
        # Try adjacent tiers
        adjacent_tiers = {"easy": ["medium", "hard"], "medium": ["easy", "hard"], "hard": ["medium", "easy"]}.get(tier, [])
        for adj_tier in adjacent_tiers:
            candidates = get_candidates_from_pool(goal_type, adj_tier)
            if candidates:
                tier = adj_tier
                break
                
    if not candidates:
        # Final fallback, ignore exclusions or just use general medium
        pool_opts = TOPIC_POOL.get("general", {}).get("medium", [])
        candidates = pool_opts if pool_opts else ["Describe a memorable experience."]
        tier = "medium"
        goal_type = "general"
        
    chosen_text = random.choice(candidates)
    
    return {
        "id": str(uuid.uuid4())[:8],
        "text": chosen_text,
        "tier": tier,
        "difficulty": tier,
        "goal_type": goal_type,
        "target_skill": weakest_skill,
        "category": "opinion",
    }


@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_session(
    request: Request,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    topic_id: str = Form(...),
    topic_text: str = Form(...),
    speaking_goal: Optional[str] = Form(None),
    difficulty_tier: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    content_type = audio.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Recording too short.")

    session_id = str(uuid.uuid4())
    audio_url = None

    user_id = get_user_id_from_token(authorization)
    normalized_goal = normalize_goal_local(speaking_goal)
    normalized_difficulty = normalize_difficulty_local(difficulty_tier)

    try:
        db = get_db()
        storage_path = f"sessions/{session_id}/recording.webm"
        db.storage.from_("audio-recordings").upload(
            path=storage_path, file=audio_bytes,
            file_options={"content-type": "audio/webm"},
        )
        audio_url = storage_path

        session_data = {
            "id": session_id,
            "topic_id": None,
            "topic_text": topic_text,
            "audio_url": audio_url,
            "status": "analyzing",
            "user_id": user_id,
        }

        try:
            db.table("sessions").insert({
                **session_data,
                "speaking_goal": normalized_goal,
                "difficulty_tier": normalized_difficulty,
            }).execute()
        except Exception as db_e:
            logger.warning(f"[sessions] Insert with new columns failed, retrying without: {db_e}")
            db.table("sessions").insert(session_data).execute()

        if user_id and (speaking_goal or difficulty_tier):
            try:
                pref_payload = {
                    "speaking_goal": normalized_goal,
                    "difficulty_tier": normalized_difficulty,
                    "onboarding_complete": True,
                }
                existing_profile = (
                    db.table("user_profiles")
                    .select("id")
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if existing_profile.data:
                    db.table("user_profiles").update(pref_payload).eq("user_id", user_id).execute()
                else:
                    db.table("user_profiles").insert({"user_id": user_id, **pref_payload}).execute()
            except Exception as profile_e:
                logger.warning(f"[sessions] Preference update skipped: {profile_e}")
        logger.info(f"[sessions] Created session {session_id}")
    except Exception as e:
        logger.error(f"[sessions] Upload failed {session_id}: {e}")
        # Return generic error — never leak internal details
        raise HTTPException(status_code=500, detail="Session upload failed. Please try again.")

    background_tasks.add_task(
        trigger_analysis,
        session_id=session_id,
        audio_bytes=audio_bytes,
        topic_text=topic_text,
        user_id=user_id,
        speaking_goal=normalized_goal,
        difficulty_tier=normalized_difficulty,
        authorization=authorization,
    )

    return {"session_id": session_id, "status": "analyzing", "audio_url": audio_url}


async def trigger_analysis(
    session_id: str,
    audio_bytes: bytes,
    topic_text: str,
    user_id: Optional[str] = None,
    speaking_goal: str = "general",
    difficulty_tier: str = "medium",
    authorization: str = None,
):
    """Background task — runs after the HTTP response is sent."""
    try:
        if user_id:
            profile_result = get_db().table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute()
            user_profile = profile_result.data[0] if profile_result.data else None
        else:
            user_profile = None
    except Exception:
        user_profile = None

    try:
        from analysis.pipeline import run_analysis_pipeline
        logger.info(f"[sessions] Starting pipeline for {session_id[:8]}")
        await run_analysis_pipeline(
            session_id=session_id,
            audio_bytes=audio_bytes,
            topic=topic_text,
            user_profile=user_profile,
            session_number=user_profile.get("total_sessions", 0) + 1 if user_profile else 1,
            user_id=user_id,
            speaking_goal_override=speaking_goal,
            difficulty_tier=difficulty_tier,
            authorization=authorization,
        )
    except Exception as e:
        import traceback
        logger.error(f"[sessions] Pipeline failed for {session_id}: {e}")
        traceback.print_exc()
        try:
            get_db().table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        except Exception as inner_e:
            logger.error(f"[sessions] Failed to update session status to failed: {inner_e}")


@router.get("/")
@limiter.limit("60/minute")
async def list_sessions(request: Request, authorization: Optional[str] = Header(None)):
    """Return only the authenticated user's sessions."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        result = (
            get_db()
            .table("sessions")
            .select("id, topic_text, created_at, status")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        return {"sessions": result.data}
    except Exception as e:
        logger.error(f"[sessions] list failed: {e}")
        return {"sessions": []}


@router.get("/{session_id}")
@limiter.limit("60/minute")
async def get_session(request: Request, session_id: str, authorization: Optional[str] = Header(None)):
    # Require authentication for session access
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        db = get_db()

        if session_id == "latest":
            result = (
                db.table("sessions")
                .select("*, session_metrics(*)")
                .eq("user_id", user_id)
                .eq("status", "complete")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        else:
            # SECURITY FIX: filter by user_id to prevent IDOR attacks
            result = (
                db.table("sessions")
                .select("*, session_metrics(*)")
                .eq("id", session_id)
                .eq("user_id", user_id)   # ← prevents accessing other users' sessions
                .execute()
            )

        logger.info(f"[sessions] get {session_id}: {len(result.data)} rows found")

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Session not found")

        session = result.data[0]

        metrics = session.get("session_metrics", [])
        if not metrics or len(metrics) == 0:
            if session.get("status") != "failed":
                session["status"] = "analyzing"
            session["session_metrics"] = []
            return session

        return session

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[sessions] get failed {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve session.")


@router.get("/{session_id}/transcript")
@limiter.limit("30/minute")
async def get_transcript(request: Request, session_id: str, user=Depends(get_current_user)):
    db = get_db()
    user_id = user.get("sub")

    # SECURITY FIX: Verify this session belongs to the requesting user
    session_check = db.table("sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session_check.data:
        raise HTTPException(status_code=404, detail="Session not found")

    result = db.table("session_metrics").select("*").eq("session_id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session metrics not found")
    metrics = result.data[0]

    import json

    words_raw = metrics.get("words", "[]")
    if isinstance(words_raw, str):
        try:
            words = json.loads(words_raw)
        except Exception:
            words = []
    else:
        words = words_raw or []

    filler_positions_raw = metrics.get("filler_positions", "[]")
    if isinstance(filler_positions_raw, str):
        try:
            fillers = json.loads(filler_positions_raw)
        except Exception:
            fillers = []
    else:
        fillers = filler_positions_raw or []

    filler_set = {f["word"] for f in fillers if "word" in f}

    transcript_words = []
    for w in words:
        w_type = "normal"
        if "word" not in w:
            continue
        clean_word = w["word"].strip(".,!?").lower()
        if clean_word in filler_set:
            w_type = "filler"

        transcript_words.append({
            "word": w["word"],
            "start": w.get("start", 0),
            "end": w.get("end", 0),
            "type": w_type
        })
    return transcript_words


@router.get("/{session_id}/audio-url")
@limiter.limit("30/minute")
async def get_audio_url(request: Request, session_id: str, user=Depends(get_current_user)):
    db = get_db()
    user_id = user.get("sub")

    result = db.table("sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    url = db.storage.from_("audio-recordings").create_signed_url(
        path=f"sessions/{session_id}/recording.webm",
        expires_in=3600
    )
    return {"url": url.get("signedURL", "")}
