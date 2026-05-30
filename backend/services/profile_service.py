import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

async def update_user_profile(
    session_id: str,
    nlp_result,
    acoustic_result,
    coaching_report
) -> None:
    try:
        from config import get_db
        db = get_db()
        
        # 1. Get the session from Supabase to find created_at (and topic, if needed)
        session_res = db.table("sessions").select("topic_text, created_at, user_id").eq("id", session_id).execute()
        if not session_res.data:
            logger.error(f"[Profile] Session {session_id} not found")
            return
            
        session_data = session_res.data[0]
        # Parse created_at to date (assuming ISO format)
        try:
            # Handle standard ISO with 'Z'
            created_str = session_data.get('created_at', '').replace('Z', '+00:00')
            session_date = datetime.fromisoformat(created_str).date()
        except Exception:
            session_date = datetime.utcnow().date()
            
        # Get user_id from session, fallback to first user in system if None
        user_id = session_data.get("user_id")
        if not user_id:
            try:
                users = db.auth.admin.list_users()
                if users:
                    user_id = users[0].id
                else:
                    logger.error("[Profile] No users in auth.users to use for profile.")
                    return
            except Exception as e:
                logger.error(f"[Profile] Failed to fetch users: {e}")
                return
            
        # Score Calculations
        # filler_score: 100 - min(nlp_result.fillers_per_minute * 10, 100)
        filler_rate = getattr(nlp_result, 'fillers_per_minute', 0)
        filler_score = max(0, 100 - min(filler_rate * 10, 100))
        
        # delivery_score: acoustic_result.monotony_score * 100
        monotony = getattr(acoustic_result, 'monotony_score', 0.5)
        delivery_score = min(monotony * 100, 100)
        
        # structure_score: min(nlp_result.sentence_count * 10, 100)
        sentence_count = getattr(nlp_result, 'sentence_count', 0)
        structure_score = min(sentence_count * 10, 100)
        
        # vocab_score: nlp_result.ttr_score * 100
        ttr_score = getattr(nlp_result, 'ttr_score', 0)
        vocab_score = min(ttr_score * 100, 100)
        
        # confidence_score: coaching_report.scores.confidence
        confidence_score = getattr(coaching_report.scores, 'confidence', 50)
        
        # Extract top fillers
        filler_detail = getattr(nlp_result, 'filler_detail', {})
        if isinstance(filler_detail, str):
            import json
            filler_detail = json.loads(filler_detail)
            
        # Sort by frequency and get top 3
        sorted_fillers = sorted(filler_detail.items(), key=lambda x: x[1], reverse=True)
        top_fillers_list = [{"word": word, "count": count} for word, count in sorted_fillers[:3]]
        
        # Coached on
        # coaching_report might have topic or focus_area
        focus_area = getattr(coaching_report, 'focus_area', 'general')

        # 2. Get or create the user_profiles row
        # Fetch the existing profile for THIS user.
        profile_res = db.table("user_profiles").select("*").eq("user_id", user_id).limit(1).execute()
        
        if profile_res.data:
            # UPDATE EXISTING
            profile = profile_res.data[0]
            
            # 3. Calculate new scores using EMA
            def ema(new_val, old_val):
                if old_val is None: return new_val
                return 0.3 * new_val + 0.7 * old_val
                
            new_filler = ema(filler_score, profile.get('filler_score'))
            new_delivery = ema(delivery_score, profile.get('delivery_score'))
            new_structure = ema(structure_score, profile.get('structure_score'))
            new_vocab = ema(vocab_score, profile.get('vocab_score'))
            new_confidence = ema(confidence_score, profile.get('confidence_score'))
            
            # 4. Detect trend direction for filler_score
            old_filler_score = profile.get('filler_score', new_filler)
            if new_filler > old_filler_score + 5:
                filler_trend = "improving"
            elif new_filler < old_filler_score - 5:
                filler_trend = "regressing"
            else:
                filler_trend = "stable"
                
            # 5. Update streak
            current_streak = profile.get('current_streak', 0)
            longest_streak = profile.get('longest_streak', 0)
            last_date_str = profile.get('last_session_date')
            
            if last_date_str:
                try:
                    last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
                    days_diff = (session_date - last_date).days
                    
                    if days_diff == 1:
                        current_streak += 1
                    elif days_diff == 0:
                        pass # keep streak same
                    else: # 2+ days ago or negative
                        current_streak = 1
                except Exception:
                    current_streak = 1
            else:
                current_streak = 1
                
            if current_streak > longest_streak:
                longest_streak = current_streak
                
            # 7 & 8. Update lists & total sessions
            coached_on = profile.get('coached_on') or []
            if focus_area not in coached_on:
                coached_on.append(focus_area)
                
            total_sessions = profile.get('total_sessions', 0) + 1
            
            update_data = {
                "session_id_ref": session_id,
                "filler_score": new_filler,
                "delivery_score": new_delivery,
                "structure_score": new_structure,
                "vocab_score": new_vocab,
                "confidence_score": new_confidence,
                "filler_trend": filler_trend,
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_session_date": session_date.strftime("%Y-%m-%d"),
                "top_fillers": json.dumps(top_fillers_list),
                "coached_on": coached_on,
                "last_coached": focus_area,
                "total_sessions": total_sessions
            }
            
            db.table("user_profiles").update(update_data).eq("id", profile['id']).execute()
            logger.info(f"[Profile] Updated existing user profile for session {session_id}")
            
        else:
            # CREATE NEW
            insert_data = {
                "user_id": user_id,
                "session_id_ref": session_id,
                "filler_score": filler_score,
                "delivery_score": delivery_score,
                "structure_score": structure_score,
                "vocab_score": vocab_score,
                "confidence_score": confidence_score,
                "filler_trend": "stable",
                "current_streak": 1,
                "longest_streak": 1,
                "last_session_date": session_date.strftime("%Y-%m-%d"),
                "top_fillers": json.dumps(top_fillers_list),
                "coached_on": [focus_area],
                "last_coached": focus_area,
                "total_sessions": 1
            }
            
            db.table("user_profiles").insert(insert_data).execute()
            logger.info(f"[Profile] Created new user profile for session {session_id}")

    except Exception as e:
        logger.error(f"[Profile] Error updating user profile: {e}")
        import traceback
        traceback.print_exc()
