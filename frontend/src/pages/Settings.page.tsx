import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { API_CONFIGURED, API_URL, APP_BASE_URL, VAPID_PUBLIC_KEY } from '../constants';
import {
  User, Sparkles, Monitor, Bell, Mic, Shield, Brain, HelpCircle, Info,
  Check, Download, Trash2, ChevronRight, Moon, Sun,
  RefreshCw, Laptop, ExternalLink, Edit3, X, Save, AlertTriangle
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface ProfileStatus {
  onboarding_complete: boolean;
  speaking_goal: string;
  display_name: string | null;
  difficulty_tier: string;
  recording_duration_secs: number;
  coaching_style: string;
  feedback_detail: string;
  appearance_preferences: AppearancePrefs;
  notification_preferences: NotificationPrefs;
  audio_preferences: AudioPrefs;
  preferred_pace_label: string;
  preferred_feedback_label: string;
}

interface AppearancePrefs {
  accentColor: string;
  uiDensity: string;
  roundedCorners: number;
}

interface NotificationPrefs {
  dailyReminder: boolean;
  weeklyReport: boolean;
  achievements: boolean;
  sessionCompletion: boolean;
  streakAlerts: boolean;
  email: boolean;
  push: boolean;
}

interface AudioPrefs {
  noiseCancellation: boolean;
  sensitivity: number;
  autoGain: boolean;
  voiceEnhancement: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function patchPreferences(token: string, payload: Record<string, unknown>) {
  if (!API_CONFIGURED) {
    throw new Error('Fluently is not connected to its API yet. Please try again after deployment configuration is completed.');
  }
  const res = await fetch(`${API_URL}/dashboard/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Unable to save preferences (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save changes. Please try again.';
}

// ── localStorage keys (used as primary persistence; backend is secondary sync) ──
const LS = {
  COACHING_STYLE: 'sq_coaching_style',
  FEEDBACK_DETAIL: 'sq_feedback_detail',
  SPEAKING_GOAL:   'sq_speaking_goal',
  DIFFICULTY:      'sq_difficulty',
  NOTIFICATIONS:   'sq_notifications',
  AUDIO:           'sq_audio',
} as const;

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return (typeof fallback === 'object' ? JSON.parse(raw) : raw) as T;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value)); } catch {}
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function registerPushSubscription(token: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Missing VITE_VAPID_PUBLIC_KEY');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await navigator.serviceWorker.register(`${APP_BASE_URL}service-worker.js`);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const subJson = subscription.toJSON();

  const res = await fetch(`${API_URL}/dashboard/push-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Unable to register browser push (${res.status})`);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const {
    theme,
    toggleTheme,
    accentColor,
    setAccentColor,
    borderRadius: roundedCorners,
    setBorderRadius: setRoundedCorners,
    uiDensity,
    setUiDensity,
  } = useTheme();
  const { user } = useAuth();

  type TabId = 'profile' | 'aicoach' | 'appearance' | 'notifications' | 'audio' | 'privacy' | 'personalization' | 'help' | 'about';
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // ── Loaded from backend ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState('');

  // ── Profile tab ───────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState('');

  // ── AI Coach tab ── (localStorage-first: survives refresh & DB migration gap) ──
  const [coachingStyle, setCoachingStyle] = useState(() => lsGet(LS.COACHING_STYLE, 'Balanced'));
  const [feedbackDetail, setFeedbackDetail] = useState(() => lsGet(LS.FEEDBACK_DETAIL, 'Detailed'));
  const [speakingGoal, setSpeakingGoal] = useState(() => lsGet(LS.SPEAKING_GOAL, 'general'));
  const [difficulty, setDifficulty] = useState(() => lsGet(LS.DIFFICULTY, 'beginner'));
  const [savingAI, setSavingAI] = useState(false);
  const [aiSaveMsg, setAiSaveMsg] = useState('');

  // ── Appearance tab ────────────────────────────────────────────────────────
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceSaveMsg, setAppearanceSaveMsg] = useState('');

  // ── Notifications tab ── (localStorage-first) ────────────────────────────
  const DEFAULT_NOTIFS: NotificationPrefs = { dailyReminder: true, weeklyReport: true, achievements: true, sessionCompletion: true, streakAlerts: true, email: false, push: true };
  const [notifications, setNotifications] = useState<NotificationPrefs>(() => lsGet(LS.NOTIFICATIONS, DEFAULT_NOTIFS));
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifSaveMsg, setNotifSaveMsg] = useState('');

  // ── Audio tab ── (localStorage-first) ────────────────────────────────────
  const DEFAULT_AUDIO: AudioPrefs = { noiseCancellation: true, sensitivity: 75, autoGain: true, voiceEnhancement: true };
  const [audioSettings, setAudioSettings] = useState<AudioPrefs>(() => lsGet(LS.AUDIO, DEFAULT_AUDIO));
  const [savingAudio, setSavingAudio] = useState(false);
  const [audioSaveMsg, setAudioSaveMsg] = useState('');
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyzerRef = useRef<AnalyserNode | null>(null);
  const micAnimRef = useRef<number>(0);

  // ── Privacy tab ───────────────────────────────────────────────────────────
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  // ── Fetch profile from backend ────────────────────────────────────────────
  useEffect(() => {
    async function fetchProfile() {
      setLoadingProfile(true);
      setProfileLoadError('');
      try {
        const token = await getToken();
        if (!token) throw new Error('Sign in again to load your saved settings.');
        if (!API_CONFIGURED) throw new Error('Fluently is not connected to its API yet. Changes cannot be saved on this deployment.');
        const res = await fetch(`${API_URL}/dashboard/profile-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Unable to load settings (${res.status})`);
        }
        const data: ProfileStatus = await res.json();
        setProfile(data);

        // Backend is always the source of truth now that DB columns exist.
        // localStorage provides instant initial values above (no flicker),
        // but the backend fetch always wins and enables cross-device sync.
        if (data.display_name) setDisplayName(data.display_name);

        // AI Coach prefs — always apply from backend (cross-device sync)
        if (data.speaking_goal)  setSpeakingGoal(data.speaking_goal);
        if (data.difficulty_tier) setDifficulty(data.difficulty_tier);
        if (data.coaching_style)  setCoachingStyle(data.coaching_style);
        if (data.feedback_detail) setFeedbackDetail(data.feedback_detail);
        // Also update localStorage so next load is instant
        if (data.speaking_goal)   lsSet(LS.SPEAKING_GOAL, data.speaking_goal);
        if (data.difficulty_tier) lsSet(LS.DIFFICULTY, data.difficulty_tier);
        if (data.coaching_style)  lsSet(LS.COACHING_STYLE, data.coaching_style);
        if (data.feedback_detail) lsSet(LS.FEEDBACK_DETAIL, data.feedback_detail);

        // Appearance — always apply from backend (cross-device sync)
        if (data.appearance_preferences) {
          const savedAccent = data.appearance_preferences.accentColor;
          const safeAccent = ['green', 'blue', 'purple', 'orange', 'red'].includes(savedAccent) ? savedAccent : 'green';
          const safeDensity = data.appearance_preferences.uiDensity === 'Compact' ? 'Compact' : 'Comfortable';
          setAccentColor(safeAccent as Parameters<typeof setAccentColor>[0]);
          setUiDensity(safeDensity);
          setRoundedCorners(data.appearance_preferences.roundedCorners ?? 24);
        }

        // Notifications — always apply from backend (cross-device sync)
        if (data.notification_preferences) {
          setNotifications(data.notification_preferences);
          lsSet(LS.NOTIFICATIONS, data.notification_preferences);
        }
        // Audio — always apply from backend (cross-device sync)
        if (data.audio_preferences) {
          const audio = {
            noiseCancellation: data.audio_preferences.noiseCancellation ?? true,
            sensitivity: data.audio_preferences.sensitivity ?? 75,
            autoGain: data.audio_preferences.autoGain ?? true,
            voiceEnhancement: data.audio_preferences.voiceEnhancement ?? true,
          };
          setAudioSettings(audio);
          lsSet(LS.AUDIO, audio);
        }
      } catch (e) {
        console.error('Error fetching profile:', e);
        setProfileLoadError(errorMessage(e));
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, []);

  // ThemeContext (in App root) already applies accent/radius/density CSS vars
  // on every page load and whenever they change — no duplicate useEffect needed here.


  // ── Save helpers ──────────────────────────────────────────────────────────
  const showMsg = (setter: (m: string) => void, msg: string) => {
    setter(msg);
    setTimeout(() => setter(''), 3000);
  };

  const saveDisplayName = async () => {
    if (!tempName.trim()) return;
    setSavingProfile(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await patchPreferences(token, { display_name: tempName.trim() });
      setDisplayName(tempName.trim());
      setIsEditingName(false);
      showMsg(setProfileSaveMsg, '✓ Name saved');
    } catch (e) {
      showMsg(setProfileSaveMsg, `✗ ${errorMessage(e)}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAICoach = async () => {
    setSavingAI(true);
    // Always persist to localStorage first — works even if backend fails
    lsSet(LS.COACHING_STYLE, coachingStyle);
    lsSet(LS.FEEDBACK_DETAIL, feedbackDetail);
    lsSet(LS.SPEAKING_GOAL, speakingGoal);
    lsSet(LS.DIFFICULTY, difficulty);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await patchPreferences(token, {
        coaching_style: coachingStyle,
        feedback_detail: feedbackDetail,
        speaking_goal: speakingGoal,
        difficulty_tier: difficulty,
      });
      showMsg(setAiSaveMsg, '✓ AI preferences saved!');
    } catch (e) {
      // Still saved to localStorage, just warn about backend
      showMsg(setAiSaveMsg, '✓ Saved locally (sync pending)');
    } finally {
      setSavingAI(false);
    }
  };

  const saveAppearance = async () => {
    setSavingAppearance(true);
    // ThemeContext setters (setAccentColor, setBorderRadius, setUiDensity) already handle
    // CSS variable application + localStorage when the user clicks buttons in real-time.
    // saveAppearance only needs to persist the current ThemeContext state to the backend.
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await patchPreferences(token, {
        appearance_preferences: { accentColor, uiDensity, roundedCorners },
      });
      showMsg(setAppearanceSaveMsg, '✓ Appearance saved!');
    } catch (e) {
      showMsg(setAppearanceSaveMsg, `✗ ${errorMessage(e)}`);
    } finally {
      setSavingAppearance(false);
    }
  };

  const saveNotifications = async () => {
    setSavingNotif(true);
    // Persist locally first
    lsSet(LS.NOTIFICATIONS, notifications);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await patchPreferences(token, { notification_preferences: notifications });
      if (notifications.push) {
        try {
          await registerPushSubscription(token);
          showMsg(setNotifSaveMsg, '✓ Notifications saved!');
        } catch (_pushError) {
          showMsg(setNotifSaveMsg, '✓ Saved (push needs HTTPS)');
        }
      } else {
        showMsg(setNotifSaveMsg, '✓ Notifications saved!');
      }
    } catch (e) {
      showMsg(setNotifSaveMsg, `✗ ${errorMessage(e)}`);
    } finally {
      setSavingNotif(false);
    }
  };

  const saveAudioSettings = async () => {
    setSavingAudio(true);
    // Persist locally first
    lsSet(LS.AUDIO, audioSettings);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await patchPreferences(token, { audio_preferences: audioSettings });
      showMsg(setAudioSaveMsg, '✓ Audio settings saved');
    } catch (e) {
      showMsg(setAudioSaveMsg, `✗ ${errorMessage(e)}`);
    } finally {
      setSavingAudio(false);
    }
  };

  // ── Real microphone test ───────────────────────────────────────────────────
  const startMicTest = useCallback(async () => {
    if (micTesting) {
      // Stop the test
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      cancelAnimationFrame(micAnimRef.current);
      setMicTesting(false);
      setMicLevel(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      micAnalyzerRef.current = analyzer;
      setMicTesting(true);

      const data = new Uint8Array(analyzer.frequencyBinCount);
      const tick = () => {
        analyzer.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, Math.round(avg * 2)));
        micAnimRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Auto-stop after 10 seconds
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(micAnimRef.current);
        setMicTesting(false);
        setMicLevel(0);
      }, 10000);
    } catch (e) {
      alert('Could not access microphone. Please allow microphone permission in your browser.');
      setMicTesting(false);
    }
  }, [micTesting]);

  // ── Privacy actions ────────────────────────────────────────────────────────
  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/dashboard/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluently-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export data. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePurgeAudio = async () => {
    if (!purgeConfirm) { setPurgeConfirm(true); return; }
    setPurging(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/dashboard/purge-audio`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Purge failed');
      showMsg(setPurgeMsg, '✓ Audio recordings purged');
      setPurgeConfirm(false);
    } catch (e) {
      showMsg(setPurgeMsg, '✗ Failed to purge');
    } finally {
      setPurging(false);
    }
  };

  const handleResetPersonalization = async () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    setResetting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/dashboard/reset-personalization`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Reset failed');
      showMsg(setResetMsg, '✓ AI memory reset');
      setResetConfirm(false);
    } catch (e) {
      showMsg(setResetMsg, '✗ Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const userEmail = user?.email || '';
  const emailName = user?.email
    ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)
    : '';
  const resolvedName = displayName || user?.user_metadata?.full_name || emailName || 'Speaker';
  const userInitials = resolvedName.charAt(0).toUpperCase();
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const goalLabels: Record<string, string> = {
    general: 'General', orator: 'Public Speaking', presenter: 'Presentations',
    interviewer: 'Interviews', debater: 'Debates',
  };
  const diffLabels: Record<string, string> = {
    beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
  };

  const navItems = [
    { id: 'profile', label: 'Profile & Account', icon: User },
    { id: 'aicoach', label: 'AI Coach Preferences', icon: Sparkles },
    { id: 'appearance', label: 'Appearance & UI', icon: Monitor },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'audio', label: 'Audio & Recording', icon: Mic },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'personalization', label: 'AI Personalization', icon: Brain },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
    { id: 'about', label: 'About Fluently', icon: Info },
  ] as const;

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-md)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24 pt-8 px-4 sm:px-8 relative overflow-x-hidden animate-fadeSlideUp" style={{ background: 'var(--bg-base)' }}>
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full pointer-events-none z-0 opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(62,140,0,0.1) 0%, transparent 70%)', filter: 'blur(100px)' }}
      />

      <div className="max-w-[1200px] mx-auto relative z-10">

        {/* Header */}
        <header className="mb-8 pb-4 border-b border-[var(--border)]">
          <h1 className="text-[32px] sm:text-[36px] font-[800] text-[var(--text-primary)] tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
            Settings
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] font-medium">
            Manage your account preferences, AI coach behavior, and workspace customization.
          </p>
        </header>

        {profileLoadError && (
          <div role="alert" className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] font-semibold text-red-300">
            Saved settings are unavailable: {profileLoadError}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Sidebar */}
          <aside className="w-full lg:w-[280px] shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-3 shadow-xl sticky top-8">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[14px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-md'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-black/15 text-[var(--accent-text)]' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                        <Icon size={16} />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight size={16} className="text-[var(--accent-text)]" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content Panel */}
          <div className="flex-1 w-full space-y-8">

            {/* ── Profile & Account ── */}
            {activeTab === 'profile' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">User Profile</h2>
                    <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage your account information.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => { setTempName(resolvedName); setIsEditingName(true); }}
                  >
                    <div className="w-20 h-20 rounded-full bg-[var(--accent)] text-[var(--accent-text)] font-extrabold text-[26px] flex items-center justify-center shadow-md border-4 border-[var(--bg-card)]">
                      {userInitials}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                      Edit
                    </div>
                  </div>

                  <div className="space-y-1 text-center sm:text-left flex-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-2 max-w-sm">
                        <input
                          type="text"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveDisplayName()}
                          className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-[var(--bg-hover)] text-[16px] font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                          placeholder="Enter your name"
                          maxLength={80}
                        />
                        <button
                          onClick={saveDisplayName}
                          disabled={savingProfile}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-[12px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <Save size={12} />
                          {savingProfile ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="p-1.5 rounded-xl bg-[var(--bg-hover)] text-[var(--text-secondary)] shrink-0 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-[22px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{resolvedName}</span>
                        <button onClick={() => { setTempName(resolvedName); setIsEditingName(true); }} className="text-[var(--text-tertiary)] hover:text-emerald-400 transition-colors cursor-pointer">
                          <Edit3 size={16} />
                        </button>
                      </h3>
                    )}
                    {profileSaveMsg && (
                      <p className={`text-[13px] font-bold ${profileSaveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{profileSaveMsg}</p>
                    )}
                    <p className="text-[14px] text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                      <span>{userEmail}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Verified Auth Session" />
                    </p>
                    {joinDate && (
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium pt-1">Joined {joinDate}</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ── AI Coach Preferences ── */}
            {activeTab === 'aicoach' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Sparkles size={20} className="text-emerald-400" /> AI Coach Preferences
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Fine-tune how your AI speech coach provides analysis and critique.</p>
                </div>

                <div className="space-y-6">
                  {/* Coaching Style */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Coaching Style</label>
                    <div className="grid grid-cols-3 gap-3 bg-[var(--bg-hover)] p-1.5 rounded-2xl border border-[var(--border)]">
                      {['Encouraging', 'Balanced', 'Strict'].map(style => (
                        <button
                          key={style}
                          onClick={() => setCoachingStyle(style)}
                          className={`py-2.5 rounded-xl font-bold text-[13px] transition-all cursor-pointer ${coachingStyle === style ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                      {coachingStyle === 'Encouraging' && 'Positive reinforcement focus — ideal for building confidence.'}
                      {coachingStyle === 'Balanced' && 'Mix of praise and critique — the default for most speakers.'}
                      {coachingStyle === 'Strict' && 'Detailed critiques with high standards — for advanced improvement.'}
                    </p>
                  </div>

                  {/* Feedback Detail */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Feedback Detail Level</label>
                    <div className="grid grid-cols-3 gap-3 bg-[var(--bg-hover)] p-1.5 rounded-2xl border border-[var(--border)]">
                      {['Basic', 'Detailed', 'Expert'].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setFeedbackDetail(lvl)}
                          className={`py-2.5 rounded-xl font-bold text-[13px] transition-all cursor-pointer ${feedbackDetail === lvl ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                      {feedbackDetail === 'Basic' && 'Key scores and a single top tip.'}
                      {feedbackDetail === 'Detailed' && 'Full breakdown with specific examples and exercises.'}
                      {feedbackDetail === 'Expert' && 'In-depth linguistic and acoustic analysis with advanced coaching.'}
                    </p>
                  </div>

                  {/* Speaking Goal */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Primary Speaking Goal</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'general', label: 'General' },
                        { value: 'interviewer', label: 'Interviews' },
                        { value: 'orator', label: 'Public Speaking' },
                        { value: 'presenter', label: 'Presentations' },
                        { value: 'debater', label: 'Debates' },
                      ].map(g => (
                        <button
                          key={g.value}
                          onClick={() => setSpeakingGoal(g.value)}
                          className={`px-4 py-2 rounded-xl font-bold text-[13px] border transition-all cursor-pointer ${speakingGoal === g.value ? 'bg-[var(--accent)] text-[var(--accent-text)] border-transparent' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Preferred Difficulty</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'beginner', label: 'Beginner' },
                        { value: 'intermediate', label: 'Intermediate' },
                        { value: 'advanced', label: 'Advanced' },
                      ].map(d => (
                        <button
                          key={d.value}
                          onClick={() => setDifficulty(d.value)}
                          className={`px-4 py-2 rounded-xl font-bold text-[13px] border transition-all cursor-pointer ${difficulty === d.value ? 'bg-[var(--accent)] text-[var(--accent-text)] border-transparent' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  {aiSaveMsg && (
                    <p className={`text-[13px] font-bold ${aiSaveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{aiSaveMsg}</p>
                  )}
                  <button
                    onClick={saveAICoach}
                    disabled={savingAI}
                    className="ml-auto px-5 py-2.5 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-2 transition-all"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    <Save size={14} />
                    {savingAI ? 'Saving...' : 'Save AI Preferences'}
                  </button>
                </div>
              </section>
            )}

            {/* ── Appearance & UI ── */}
            {activeTab === 'appearance' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Monitor size={20} className="text-blue-400" /> Appearance & Interface
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Customize workspace theme, accent highlights, and visual density.</p>
                </div>

                <div className="space-y-6">
                  {/* Theme */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Color Theme</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Switch between light and dark mode</p>
                    </div>
                    <button
                      onClick={() => toggleTheme()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[13px] shadow-2xs hover:bg-[var(--bg-card-hover)] cursor-pointer"
                    >
                      {theme === 'dark' ? <Moon size={15} className="text-blue-400" /> : <Sun size={15} className="text-amber-400" />}
                      <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                  </div>

                  {/* Accent Color */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Accent Color</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Choose primary branding highlight color (saved to profile)</p>
                    </div>
                    <div className="flex items-center gap-2">
                       {([
                         { id: 'green',  hex: '#C8F97D', ring: 'ring-[#C8F97D]/40' },
                         { id: 'blue',   hex: '#60A5FA', ring: 'ring-[#60A5FA]/40' },
                         { id: 'purple', hex: '#C084FC', ring: 'ring-[#C084FC]/40' },
                         { id: 'orange', hex: '#FB923C', ring: 'ring-[#FB923C]/40' },
                         { id: 'red',    hex: '#F87171', ring: 'ring-[#F87171]/40' },
                       ] as const).map((acc) => (
                         <button
                           key={acc.id}
                           onClick={() => setAccentColor(acc.id as Parameters<typeof setAccentColor>[0])}
                           style={{ backgroundColor: acc.hex }}
                           className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                             accentColor === acc.id
                               ? `ring-4 ${acc.ring} scale-110`
                               : 'opacity-70 hover:opacity-100 hover:scale-105'
                           }`}
                         >
                           {accentColor === acc.id && <Check size={14} className="text-black" />}
                         </button>
                       ))}
                     </div>
                  </div>

                  {/* UI Density */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">UI Layout Density</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Adjust padding and item spacing</p>
                    </div>
                    <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border)]">
                      {(['Comfortable', 'Compact'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setUiDensity(d)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[12px] cursor-pointer ${uiDensity === d ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rounded Corners */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Border Radius</p>
                      <span className="text-[13px] font-extrabold text-[var(--text-primary)] bg-[var(--bg-card)] px-2.5 py-0.5 rounded-md border border-[var(--border)]">{roundedCorners}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="32"
                      value={roundedCorners}
                      onChange={e => setRoundedCorners(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  {appearanceSaveMsg && (
                    <p className={`text-[13px] font-bold ${appearanceSaveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{appearanceSaveMsg}</p>
                  )}
                  <button
                    onClick={saveAppearance}
                    disabled={savingAppearance}
                    className="ml-auto px-5 py-2.5 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-2"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    <Save size={14} />
                    {savingAppearance ? 'Saving...' : 'Save Appearance'}
                  </button>
                </div>
              </section>
            )}

            {/* ── Notifications ── */}
            {activeTab === 'notifications' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Bell size={20} className="text-amber-400" /> Notification Center
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage alerts, streak updates, and practice reminders.</p>
                </div>

                <div className="space-y-2">
                  {/* Push notifications status */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[13px] font-bold text-amber-300 flex items-center gap-1.5">🔔 Push Notifications Status</p>
                    <p className="text-[12px] text-amber-200/80 font-medium mt-1">
                      Push notifications require: <strong>(1)</strong> HTTPS deployment, <strong>(2)</strong> browser permission granted, and <strong>(3)</strong> VAPID keys set in your Render environment (<code className="text-amber-300">VAPID_PRIVATE_KEY</code>, <code className="text-amber-300">VITE_VAPID_PUBLIC_KEY</code>). If any of these are missing, push won't fire — but all other preferences are saved correctly.
                    </p>
                  </div>
                  {/* Email status */}
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-[13px] font-bold text-blue-300 flex items-center gap-1.5">📧 Email Notifications Status</p>
                    <p className="text-[12px] text-blue-200/80 font-medium mt-1">
                      Email delivery requires <code className="text-blue-300">RESEND_API_KEY</code> and <code className="text-blue-300">RESEND_FROM_EMAIL</code> set in your Render backend environment. Without these, email toggles are saved but no emails are sent.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-[var(--border)]">
                  {[
                    { key: 'dailyReminder', title: 'Daily Practice Reminder', desc: 'Keep your streak alive with a gentle nudge' },
                    { key: 'weeklyReport', title: 'Weekly Progress Report', desc: 'Receive synthesized AI mastery summaries' },
                    { key: 'achievements', title: 'Achievement Notifications', desc: 'Get alerted when unlocking milestone badges' },
                    { key: 'sessionCompletion', title: 'Session Completion Summary', desc: 'Instant breakdown report upon finishing a drill' },
                    { key: 'streakAlerts', title: 'Streak Alerts', desc: 'Urgent notifications before streak reset' },
                    { key: 'email', title: 'Email Notifications', desc: 'Send summaries directly to your inbox' },
                    { key: 'push', title: 'Push Notifications', desc: 'Browser and mobile live alerts' },
                  ].map(item => (
                    <div key={item.key} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[15px] font-bold text-[var(--text-primary)]">{item.title}</p>
                        <p className="text-[12px] text-[var(--text-tertiary)] font-medium">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof NotificationPrefs] }))}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${notifications[item.key as keyof NotificationPrefs] ? 'bg-emerald-500' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${notifications[item.key as keyof NotificationPrefs] ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  {notifSaveMsg && (
                    <p className={`text-[13px] font-bold ${notifSaveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{notifSaveMsg}</p>
                  )}
                  <button
                    onClick={saveNotifications}
                    disabled={savingNotif}
                    className="ml-auto px-5 py-2.5 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-2"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    <Save size={14} />
                    {savingNotif ? 'Saving...' : 'Save Notifications'}
                  </button>
                </div>
              </section>
            )}

            {/* ── Audio & Recording ── */}
            {activeTab === 'audio' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Mic size={20} className="text-purple-400" /> Audio & Microphone
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Configure microphone input and audio processing preferences.</p>
                </div>

                <div className="space-y-6">
                  {/* Real Microphone Test */}
                  <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-bold text-purple-300">Live Microphone Test</p>
                      <p className="text-[12px] text-purple-400 font-medium">Verify real audio input levels before starting sessions</p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {micTesting && (
                        <div className="flex-1 sm:w-32 h-3 bg-purple-950 rounded-full overflow-hidden border border-purple-500/30">
                          <div
                            className="h-full bg-purple-400 transition-all duration-75 rounded-full"
                            style={{ width: `${micLevel}%` }}
                          />
                        </div>
                      )}
                      <button
                        onClick={startMicTest}
                        className={`px-4 py-2 rounded-xl font-bold text-[13px] transition-all cursor-pointer shadow-2xs shrink-0 ${micTesting ? 'bg-red-500 text-white' : 'bg-purple-500 text-black hover:bg-purple-400'}`}
                      >
                        {micTesting ? '⏹ Stop Test' : '🎙️ Test Microphone'}
                      </button>
                    </div>
                  </div>

                  {/* Sensitivity Slider */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Microphone Sensitivity</p>
                      <span className="text-[13px] font-extrabold text-[var(--text-primary)] bg-[var(--bg-card)] px-2.5 py-0.5 rounded-md border border-[var(--border)]">{audioSettings.sensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={audioSettings.sensitivity}
                      onChange={e => setAudioSettings(prev => ({ ...prev, sensitivity: Number(e.target.value) }))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Audio Toggles */}
                  <div className="divide-y divide-[var(--border)]">
                    {[
                      { key: 'noiseCancellation', title: 'Noise Cancellation', desc: 'Suppress background noise during recording' },
                      { key: 'autoGain', title: 'Auto Gain Control', desc: 'Normalize voice volume dynamically' },
                      { key: 'voiceEnhancement', title: 'Voice Enhancement', desc: 'Boost vocal clarity and tone' },
                    ].map(item => (
                      <div key={item.key} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                        <div>
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">{item.title}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)] font-medium">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => setAudioSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof AudioPrefs] }))}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${audioSettings[item.key as keyof AudioPrefs] ? 'bg-emerald-500' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${audioSettings[item.key as keyof AudioPrefs] ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  {audioSaveMsg && (
                    <p className={`text-[13px] font-bold ${audioSaveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{audioSaveMsg}</p>
                  )}
                  <button
                    onClick={saveAudioSettings}
                    disabled={savingAudio}
                    className="ml-auto px-5 py-2.5 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-2"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    <Save size={14} />
                    {savingAudio ? 'Saving...' : 'Save Audio Settings'}
                  </button>
                </div>
              </section>
            )}

            {/* ── Privacy & Security ── */}
            {activeTab === 'privacy' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Shield size={20} className="text-emerald-400" /> Privacy & Security
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage your data, exports, and account security.</p>
                </div>

                <div className="space-y-4">
                  {/* Download Data */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Download My Data</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Export all transcripts and performance scores as JSON</p>
                    </div>
                    <button
                      onClick={handleDownloadData}
                      disabled={downloading}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[13px] hover:bg-[var(--bg-card-hover)] cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Download size={15} />
                      {downloading ? 'Exporting...' : 'Download Data'}
                    </button>
                  </div>

                  {/* Purge Audio */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[15px] font-bold text-amber-400">Delete Audio Recordings</p>
                        <p className="text-[12px] text-amber-300/80 font-medium">Permanently remove your raw voice recordings from cloud storage</p>
                      </div>
                      <button
                        onClick={handlePurgeAudio}
                        disabled={purging}
                        className={`px-4 py-2 rounded-xl font-bold text-[13px] cursor-pointer flex items-center gap-1.5 transition-all ${purgeConfirm ? 'bg-red-500 text-white' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
                      >
                        <Trash2 size={15} />
                        {purging ? 'Purging...' : purgeConfirm ? 'Confirm Delete' : 'Purge Audio'}
                      </button>
                    </div>
                    {purgeConfirm && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertTriangle size={14} className="text-red-400 shrink-0" />
                        <p className="text-[12px] text-red-400 font-medium">This cannot be undone. Click "Confirm Delete" to proceed, or navigate away to cancel.</p>
                      </div>
                    )}
                    {purgeMsg && <p className={`text-[13px] font-bold ${purgeMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{purgeMsg}</p>}
                  </div>

                  {/* Active Session Info */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] space-y-3">
                    <p className="text-[14px] font-bold text-[var(--text-primary)]">Active Session</p>
                    <div className="flex items-center justify-between text-[13px] bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <Laptop size={16} className="text-emerald-400" />
                        <span className="font-bold text-[var(--text-primary)]">Web Browser Session</span>
                      </div>
                      <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active Now</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Authenticated as: {userEmail}</p>
                  </div>
                </div>
              </section>
            )}

            {/* ── AI Personalization ── */}
            {activeTab === 'personalization' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Brain size={20} className="text-emerald-400" /> AI Learning Profile
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Your synthesized AI memory and adaptive coaching profile — built from your session history.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Preferred Speaking Pace</span>
                    <p className="text-[16px] font-extrabold text-[var(--text-primary)] mt-1">
                      {profile?.preferred_pace_label || 'Steady (115 – 145 WPM)'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Feedback Style</span>
                    <p className="text-[16px] font-extrabold text-[var(--text-primary)] mt-1">
                      {profile?.preferred_feedback_label || `${feedbackDetail} / ${coachingStyle}`}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Speaking Goal</span>
                    <p className="text-[16px] font-extrabold text-emerald-400 mt-1">
                      {goalLabels[speakingGoal] || speakingGoal}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Difficulty Level</span>
                    <p className="text-[16px] font-extrabold text-blue-400 mt-1">
                      {diffLabels[difficulty] || difficulty} Tier
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] space-y-3">
                  {resetMsg && <p className={`text-[13px] font-bold ${resetMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{resetMsg}</p>}
                  {resetConfirm && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      <p className="text-[12px] text-amber-400 font-medium">This will clear your AI coaching history and skill scores. Your session recordings are kept. Click again to confirm.</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handleResetPersonalization}
                      disabled={resetting}
                      className={`px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all cursor-pointer flex items-center gap-2 border ${resetConfirm ? 'bg-amber-500 text-black border-transparent' : 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                    >
                      <RefreshCw size={14} />
                      {resetting ? 'Resetting...' : resetConfirm ? 'Confirm Reset' : 'Reset AI Memory'}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── Help & Support ── */}
            {activeTab === 'help' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <HelpCircle size={20} className="text-emerald-400" /> Help & Support
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Get assistance or report issues with Fluently.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'GitHub Repository', desc: 'View source code and open issues', icon: '📦', href: 'https://github.com/coder-jane06/Fluently' },
                    { title: 'Report a Bug', desc: 'Submit audio processing or UI issues', icon: '🐛', href: 'https://github.com/coder-jane06/Fluently/issues/new' },
                    { title: 'Feature Requests', desc: 'Suggest new AI coach features', icon: '💡', href: 'https://github.com/coder-jane06/Fluently/issues/new' },
                    { title: 'Contact via Email', desc: 'Reach the team directly', icon: '📧', href: 'mailto:admin@fluently.com' },
                  ].map((h, i) => (
                    <a
                      key={i}
                      href={h.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:shadow-sm transition-all cursor-pointer flex items-start gap-4 group no-underline"
                    >
                      <span className="text-[26px] shrink-0">{h.icon}</span>
                      <div className="flex-1">
                        <h4 className="text-[15px] font-bold text-[var(--text-primary)] group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                          <span>{h.title}</span>
                          <ExternalLink size={14} className="text-[var(--text-tertiary)] group-hover:text-emerald-400" />
                        </h4>
                        <p className="text-[12px] text-[var(--text-tertiary)] font-medium mt-1">{h.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── About Fluently ── */}
            {activeTab === 'about' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-text)] font-extrabold text-[24px] flex items-center justify-center shadow-md">
                    🎙️
                  </div>
                  <div>
                    <h2 className="text-[22px] font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                      Fluently
                    </h2>
                    <p className="text-[13px] text-[var(--text-tertiary)] font-semibold">AI-Powered Speech Coach</p>
                  </div>
                </div>

                <div className="space-y-3 text-[14px]">
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">Backend</span>
                    <span className="text-[var(--text-tertiary)] font-medium">FastAPI + Supabase</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">AI Models</span>
                    <span className="text-[var(--text-tertiary)] font-medium">Whisper + Claude + Groq</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">Frontend</span>
                    <span className="text-[var(--text-tertiary)] font-medium">React 19 + Vite + TypeScript</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-bold text-[var(--text-secondary)]">Source Code</span>
                    <a
                      href="https://github.com/coder-jane06/Fluently"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 font-bold text-[13px] hover:underline flex items-center gap-1"
                    >
                      GitHub <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </section>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}
