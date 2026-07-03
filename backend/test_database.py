"""
Test database schema and connectivity.
Verifies that sessions and session_metrics tables are properly configured.
"""
import sys
import logging
from config import get_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

def test_database():
    """Test Supabase database connectivity and schema."""
    
    logger.info("=" * 60)
    logger.info("DATABASE CONNECTIVITY TEST")
    logger.info("=" * 60)
    
    try:
        db = get_db()
        logger.info("✅ Supabase client initialized")
        
        # Test 1: Check sessions table
        logger.info("\n[1] Testing 'sessions' table...")
        try:
            result = db.table("sessions").select("id", count="exact").limit(1).execute()
            logger.info(f"✅ Sessions table accessible (total: {result.count} rows)")
        except Exception as e:
            logger.error(f"❌ Sessions table error: {e}")
            return False
        
        # Test 2: Check session_metrics table
        logger.info("\n[2] Testing 'session_metrics' table...")
        try:
            result = db.table("session_metrics").select("session_id", count="exact").limit(1).execute()
            logger.info(f"✅ Session_metrics table accessible (total: {result.count} rows)")
        except Exception as e:
            logger.error(f"❌ Session_metrics table error: {e}")
            return False
        
        # Test 3: Check user_profiles table
        logger.info("\n[3] Testing 'user_profiles' table...")
        try:
            result = db.table("user_profiles").select("user_id", count="exact").limit(1).execute()
            logger.info(f"✅ User_profiles table accessible (total: {result.count} rows)")
        except Exception as e:
            logger.error(f"❌ User_profiles table error: {e}")
            return False
        
        # Test 4: Check topics table
        logger.info("\n[4] Testing 'topics' table...")
        try:
            result = db.table("topics").select("id, text", count="exact").limit(5).execute()
            logger.info(f"✅ Topics table accessible (total: {result.count} topics)")
            if result.data and len(result.data) > 0:
                logger.info(f"   Sample topic: \"{result.data[0].get('text', 'N/A')}\"")
        except Exception as e:
            logger.error(f"❌ Topics table error: {e}")
            return False
        
        # Test 5: Check storage bucket
        logger.info("\n[5] Testing 'audio-recordings' storage bucket...")
        try:
            buckets = db.storage.list_buckets()
            bucket_names = [b['name'] for b in buckets]
            if 'audio-recordings' in bucket_names:
                logger.info("✅ Audio-recordings bucket exists")
            else:
                logger.warning(f"⚠️  Audio-recordings bucket not found. Available: {bucket_names}")
        except Exception as e:
            logger.error(f"❌ Storage bucket error: {e}")
            # Non-critical, don't return False
        
        # Test 6: Verify session_metrics schema has required columns
        logger.info("\n[6] Verifying session_metrics schema...")
        try:
            # Try to select all key columns
            result = db.table("session_metrics").select(
                "session_id, transcript, words, filler_count, filler_detail, "
                "filler_positions, wpm, pause_count, longest_pause_sec, "
                "pitch_mean, pitch_std, coaching_report"
            ).limit(1).execute()
            logger.info("✅ All required columns present in session_metrics")
        except Exception as e:
            logger.error(f"❌ Schema verification failed: {e}")
            logger.error("   Missing columns in session_metrics table")
            return False
        
        logger.info("\n" + "=" * 60)
        logger.info("DATABASE TEST COMPLETE - ALL CHECKS PASSED ✅")
        logger.info("=" * 60)
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Database test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = test_database()
    sys.exit(0 if success else 1)
