import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_sessions: number;
  last_session_date: string | null;
  grace_day_available: boolean;
  sessions_this_week?: number;
}

export function useStreak() {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${API_URL}/dashboard/streak`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          }
        });
        if (res.ok) {
          const data = await res.json();
          setStreakData(data);
        } else {
          setStreakData({
            current_streak: 0,
            longest_streak: 0,
            total_sessions: 0,
            last_session_date: null,
            grace_day_available: false
          });
        }
      } catch (err) {
        console.error("Error fetching streak data", err);
        setStreakData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStreak();
  }, []);

  return { streakData, loading };
}