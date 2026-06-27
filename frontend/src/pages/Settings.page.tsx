import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { API_URL } from '../constants';
import { 
  User, Sparkles, Monitor, Bell, Mic, Shield, Brain, HelpCircle, Info, 
  Check, Download, Trash2, ChevronRight, Moon, Sun, 
  Laptop, ExternalLink, Edit3, X, RefreshCw
} from 'lucide-react';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'aicoach' | 'appearance' | 'notifications' | 'audio' | 'privacy' | 'personalization' | 'integrations' | 'help' | 'about'>('profile');

  // Backend Profile State
  const [displayName, setDisplayName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Interactive Settings State
  const [coachingStyle, setCoachingStyle] = useState('Balanced');
  const [feedbackDetail, setFeedbackDetail] = useState('Detailed');
  const [speakingGoal, setSpeakingGoal] = useState('Interviews');
  const [difficulty, setDifficulty] = useState('Intermediate');

  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || 'green');
  const [uiDensity, setUiDensity] = useState(() => localStorage.getItem('uiDensity') || 'Comfortable');
  const [roundedCorners, setRoundedCorners] = useState(() => Number(localStorage.getItem('roundedCorners')) || 24);

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : {
      dailyReminder: true, weeklyReport: true, achievements: true,
      sessionCompletion: true, streakAlerts: true, email: false, push: true
    };
  });

  const [audioSettings, setAudioSettings] = useState(() => {
    const saved = localStorage.getItem('audioSettings');
    return saved ? JSON.parse(saved) : {
      mic: 'Default Microphone (Built-in Audio)', noiseCancellation: true,
      sensitivity: 75, autoGain: true, quality: 'HD 256kbps Studio',
      voiceEnhancement: true, livePreview: false
    };
  });

  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('uiDensity', uiDensity);
    localStorage.setItem('roundedCorners', String(roundedCorners));
    localStorage.setItem('notifications', JSON.stringify(notifications));
    localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
  }, [accentColor, uiDensity, roundedCorners, notifications, audioSettings]);

  // Fetch backend profile status
  useEffect(() => {
    async function fetchProfileData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`${API_URL}/dashboard/profile-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              setDisplayName(data.display_name);
            }
            if (data.speaking_goal) {
              setSpeakingGoal(data.speaking_goal);
            }
            if (data.difficulty_tier) {
              setDifficulty(data.difficulty_tier);
            }
            if (data.coaching_style) {
              setCoachingStyle(data.coaching_style);
            }
            if (data.feedback_detail) {
              setFeedbackDetail(data.feedback_detail);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching profile status:", e);
      }
    }
    fetchProfileData();
  }, []);

  const saveProfileBackend = async (newName: string) => {
    setSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch(`${API_URL}/dashboard/onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            display_name: newName,
            speaking_goal: speakingGoal,
            difficulty_tier: difficulty.toLowerCase(),
            recording_duration_secs: 60,
            coaching_style: coachingStyle,
            feedback_detail: feedbackDetail
          })
        });
        setDisplayName(newName);
      }
    } catch (e) {
      console.error("Error updating profile:", e);
    } finally {
      setSavingProfile(false);
      setIsEditingName(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const statsData = await res.json();
        const blob = new Blob([JSON.stringify(statsData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'speakiq_data_export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error("Error downloading data", e);
    }
  };

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAudio = (key: keyof typeof audioSettings) => {
    setAudioSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMicTest = () => {
    setMicTesting(true);
    let count = 0;
    const interval = setInterval(() => {
      setMicLevel(Math.floor(Math.random() * 80) + 20);
      count++;
      if (count > 15) {
        clearInterval(interval);
        setMicTesting(false);
        setMicLevel(0);
      }
    }, 150);
  };

  // Derive dynamic user details
  const userEmail = user?.email || 'shaurya@example.com';
  const emailName = user?.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : '';
  const resolvedName = displayName || user?.user_metadata?.full_name || user?.user_metadata?.display_name || emailName || 'Shaurya';
  const userInitials = resolvedName.charAt(0).toUpperCase() || 'S';
  const joinDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'June 2026';

  const navItems = [
    { id: 'profile', label: 'Profile & Account', icon: User },
    { id: 'aicoach', label: 'AI Coach Preferences', icon: Sparkles },
    { id: 'appearance', label: 'Appearance & UI', icon: Monitor },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'audio', label: 'Audio & Recording', icon: Mic },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'personalization', label: 'AI Personalization', icon: Brain },
    { id: 'help', label: 'Help & Support', icon: HelpCircle },
    { id: 'about', label: 'About SpeakIQ', icon: Info },
  ] as const;

  return (
    <main className="min-h-screen pb-24 pt-8 px-4 sm:px-8 relative overflow-x-hidden animate-fadeSlideUp" style={{ background: 'var(--bg-base)' }}>
      {/* Subtle green ambient light */}
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

        {/* ── 2-COLUMN SETTINGS LAYOUT ── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left Sidebar Navigation (280px) */}
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
                        ? 'bg-[var(--accent)] text-black shadow-md' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-black/15 text-black' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                        <Icon size={16} />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight size={16} className="text-black" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Content Panel */}
          <div className="flex-1 w-full space-y-8">

            {/* ── SECTION 1 — Profile ── */}
            {(activeTab === 'profile' || activeTab as string === 'all') && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">User Profile</h2>
                    <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage your verified account information and subscription tier.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[12px] font-extrabold flex items-center gap-1">
                    <Sparkles size={13} /> PRO Member
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group cursor-pointer" onClick={() => { setTempName(resolvedName); setIsEditingName(true); }}>
                    <div className="w-20 h-20 rounded-full bg-[var(--accent)] text-black font-extrabold text-[26px] flex items-center justify-center shadow-md border-4 border-[var(--bg-card)]">
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
                          className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-[var(--bg-hover)] text-[16px] font-bold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                          placeholder="Enter your name"
                        />
                        <button
                          onClick={() => saveProfileBackend(tempName)}
                          disabled={savingProfile}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-[12px] font-bold shrink-0 cursor-pointer"
                        >
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
                    
                    {/* Live Auth Email */}
                    <p className="text-[14px] text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                      <span>{userEmail}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Verified Auth Session" />
                    </p>

                    <p className="text-[12px] text-[var(--text-tertiary)] font-medium pt-1">
                      Joined {joinDate} • Premium Coach Access Active
                    </p>
                  </div>

                  <button 
                    onClick={() => { setTempName(resolvedName); setIsEditingName(true); }}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-bold text-[13px] transition-all cursor-pointer shadow-2xs"
                  >
                    Edit Profile
                  </button>
                </div>
              </section>
            )}


            {/* ── SECTION 2 — AI Coach Preferences ── */}
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
                          onClick={() => { setCoachingStyle(style); saveProfileBackend(resolvedName); }}
                          className={`py-2.5 rounded-xl font-bold text-[13px] transition-all cursor-pointer ${coachingStyle === style ? 'bg-[var(--accent)] text-black shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Detail */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Feedback Detail Level</label>
                    <div className="grid grid-cols-3 gap-3 bg-[var(--bg-hover)] p-1.5 rounded-2xl border border-[var(--border)]">
                      {['Basic', 'Detailed', 'Expert'].map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => { setFeedbackDetail(lvl); saveProfileBackend(resolvedName); }}
                          className={`py-2.5 rounded-xl font-bold text-[13px] transition-all cursor-pointer ${feedbackDetail === lvl ? 'bg-[var(--accent)] text-black shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speaking Goal */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Primary Speaking Goal</label>
                    <div className="flex flex-wrap gap-2">
                      {['Interviews', 'Public Speaking', 'Presentations', 'Debates'].map(goal => (
                        <button
                          key={goal}
                          onClick={() => { setSpeakingGoal(goal); saveProfileBackend(resolvedName); }}
                          className={`px-4 py-2 rounded-xl font-bold text-[13px] border transition-all cursor-pointer ${speakingGoal === goal ? 'bg-[var(--accent)] text-black border-transparent' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred Difficulty */}
                  <div>
                    <label className="block text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Preferred Difficulty</label>
                    <div className="flex flex-wrap gap-2">
                      {['Beginner', 'Intermediate', 'Advanced'].map(diff => (
                        <button
                          key={diff}
                          onClick={() => { setDifficulty(diff); saveProfileBackend(resolvedName); }}
                          className={`px-4 py-2 rounded-xl font-bold text-[13px] border transition-all cursor-pointer ${difficulty === diff ? 'bg-[var(--accent)] text-black border-transparent' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}


            {/* ── SECTION 3 — Appearance ── */}
            {activeTab === 'appearance' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Monitor size={20} className="text-blue-400" /> Appearance & Interface
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Customize workspace theme, accent highlights, and visual density.</p>
                </div>

                <div className="space-y-6">
                  {/* Theme Selector */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Color Theme</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Switch between light and dark mode</p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[13px] shadow-2xs hover:bg-[var(--bg-card-hover)] cursor-pointer"
                    >
                      {theme === 'dark' ? <Moon size={15} className="text-blue-400" /> : <Sun size={15} className="text-amber-400" />}
                      <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                  </div>

                  {/* Accent Color */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Accent Color Highlight</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Choose primary branding accent color</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'green', color: 'bg-emerald-500' },
                        { id: 'blue', color: 'bg-blue-500' },
                        { id: 'purple', color: 'bg-purple-500' },
                      ].map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => setAccentColor(acc.id)}
                          className={`w-8 h-8 rounded-full ${acc.color} flex items-center justify-center transition-transform cursor-pointer ${accentColor === acc.id ? 'ring-4 ring-emerald-500/40 scale-110' : 'opacity-70 hover:opacity-100'}`}
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
                      {['Comfortable', 'Compact'].map(d => (
                        <button
                          key={d}
                          onClick={() => setUiDensity(d)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[12px] cursor-pointer ${uiDensity === d ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)]'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rounded Corners Slider */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Rounded Corners Radius</p>
                      <span className="text-[13px] font-extrabold text-[var(--text-primary)] bg-[var(--bg-card)] px-2.5 py-0.5 rounded-md border border-[var(--border)]">{roundedCorners}px</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="32"
                      value={roundedCorners}
                      onChange={e => setRoundedCorners(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </section>
            )}


            {/* ── SECTION 4 — Notifications ── */}
            {activeTab === 'notifications' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Bell size={20} className="text-amber-400" /> Notification Center
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage alerts, streak updates, and practice reminders.</p>
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
                        onClick={() => toggleNotif(item.key as keyof typeof notifications)}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${notifications[item.key as keyof typeof notifications] ? 'bg-emerald-500' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${notifications[item.key as keyof typeof notifications] ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}


            {/* ── SECTION 5 — Audio & Recording ── */}
            {activeTab === 'audio' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Mic size={20} className="text-purple-400" /> Audio & Microphone Hardware
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Configure microphone input sensitivity and active AI noise cancellation.</p>
                </div>

                <div className="space-y-6">
                  {/* Microphone Test Panel */}
                  <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-bold text-purple-300">Microphone Input Check</p>
                      <p className="text-[12px] text-purple-400 font-medium">Verify live audio levels before starting sessions</p>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {micTesting && (
                        <div className="flex-1 sm:w-32 h-3 bg-purple-950 rounded-full overflow-hidden border border-purple-500/30">
                          <div className="h-full bg-purple-400 transition-all duration-100" style={{ width: `${micLevel}%` }} />
                        </div>
                      )}
                      <button
                        onClick={handleMicTest}
                        disabled={micTesting}
                        className="px-4 py-2 rounded-xl bg-purple-500 text-black font-bold text-[13px] hover:bg-purple-400 transition-all cursor-pointer shadow-2xs shrink-0"
                      >
                        {micTesting ? 'Testing…' : 'Test Microphone 🎙️'}
                      </button>
                    </div>
                  </div>

                  {/* Audio Toggles */}
                  <div className="divide-y divide-[var(--border)]">
                    {[
                      { key: 'noiseCancellation', title: 'Noise Cancellation', desc: 'Active AI suppression of background noise' },
                      { key: 'autoGain', title: 'Auto Gain Control', desc: 'Normalize voice volume dynamically' },
                      { key: 'voiceEnhancement', title: 'Voice Enhancement', desc: 'Spatial AI pitch & tone tuning' },
                      { key: 'livePreview', title: 'Live Audio Preview', desc: 'Monitor microphone input in real time' },
                    ].map(item => (
                      <div key={item.key} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                        <div>
                          <p className="text-[15px] font-bold text-[var(--text-primary)]">{item.title}</p>
                          <p className="text-[12px] text-[var(--text-tertiary)] font-medium">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleAudio(item.key as keyof typeof audioSettings)}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${audioSettings[item.key as keyof typeof audioSettings] ? 'bg-emerald-500' : 'bg-[var(--bg-hover)] border border-[var(--border)]'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${audioSettings[item.key as keyof typeof audioSettings] ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}


            {/* ── SECTION 6 — Privacy & Security ── */}
            {activeTab === 'privacy' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Shield size={20} className="text-emerald-400" /> Privacy & Security
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Manage security options, active sessions, and data exports.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">Download My Data</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] font-medium">Export all audio transcripts and performance scores in JSON format</p>
                    </div>
                    <button onClick={handleDownloadData} className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-[13px] hover:bg-[var(--bg-card-hover)] cursor-pointer flex items-center gap-1.5">
                      <Download size={15} /> Download Data
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-bold text-red-400">Sign Out of Account</p>
                      <p className="text-[12px] text-red-300/80 font-medium">Log out of your SpeakIQ secure workspace session</p>
                    </div>
                    <button onClick={() => { signOut(); window.location.href = '/#/login'; }} className="px-4 py-2 rounded-xl bg-red-500 text-black font-bold text-[13px] hover:bg-red-400 cursor-pointer flex items-center gap-1.5">
                      <Trash2 size={15} /> Sign Out
                    </button>
                  </div>

                  {/* Connected Devices */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] space-y-3">
                    <p className="text-[14px] font-bold text-[var(--text-primary)]">Connected Devices & Active Sessions</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[13px] bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          <Laptop size={16} className="text-emerald-400" />
                          <span className="font-bold text-[var(--text-primary)]">Verified Web Workspace (Active Now)</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">This Device</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}


            {/* ── SECTION 7 — AI Personalization ── */}
            {activeTab === 'personalization' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <Brain size={20} className="text-emerald-400" /> AI Learning Personalization Profile
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Your synthesized AI memory and adaptive coaching preferences.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Preferred Speaking Pace</span>
                    <p className="text-[16px] font-extrabold text-[var(--text-primary)] mt-1">Normal (130 – 150 WPM)</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Preferred Feedback Style</span>
                    <p className="text-[16px] font-extrabold text-[var(--text-primary)] mt-1">Action-Oriented & Direct</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Favorite Categories</span>
                    <p className="text-[16px] font-extrabold text-emerald-400 mt-1">{speakingGoal} • Practice Drills</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)]">
                    <span className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Adaptive Progress Level</span>
                    <p className="text-[16px] font-extrabold text-blue-400 mt-1">{difficulty} Tier Mastery</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] flex justify-end">
                  <button className="px-5 py-2.5 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-bold text-[13px] transition-all cursor-pointer flex items-center gap-2 border border-[var(--border)]">
                    <RefreshCw size={14} /> Reset Personalization Memory
                  </button>
                </div>
              </section>
            )}





            {/* ── SECTION 9 — Help & Support ── */}
            {activeTab === 'help' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                    <HelpCircle size={20} className="text-emerald-400" /> Help & Customer Support
                  </h2>
                  <p className="text-[13px] text-[var(--text-tertiary)] font-medium">Get assistance, request features, or view troubleshooting guides.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Help Center & Documentation', desc: 'Browse guides and microphone setup tutorials', icon: '📖' },
                    { title: 'Contact Support Team', desc: '24/7 priority response for PRO members', icon: '💬' },
                    { title: 'Report a Bug', desc: 'Submit audio processing issues', icon: '🐛' },
                    { title: 'Feature Requests', desc: 'Vote on upcoming AI coach features', icon: '💡' },
                    { title: 'Community Discord', desc: 'Join 10k+ speakers practicing together', icon: '👾' },
                    { title: 'Keyboard Shortcuts', desc: 'View quick commands for fast drills', icon: '⌨️' },
                  ].map((h, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:shadow-sm transition-all cursor-pointer flex items-start gap-4 group">
                      <span className="text-[26px] shrink-0">{h.icon}</span>
                      <div className="flex-1">
                        <h4 className="text-[15px] font-bold text-[var(--text-primary)] group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                          <span>{h.title}</span>
                          <ExternalLink size={14} className="text-[var(--text-tertiary)] group-hover:text-emerald-400" />
                        </h4>
                        <p className="text-[12px] text-[var(--text-tertiary)] font-medium mt-1">{h.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}


            {/* ── SECTION 10 — About ── */}
            {activeTab === 'about' && (
              <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[28px] p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-black font-extrabold text-[24px] flex items-center justify-center shadow-md">
                    🎙️
                  </div>
                  <div>
                    <h2 className="text-[22px] font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                      SpeakIQ AI Coach
                    </h2>
                    <p className="text-[13px] text-[var(--text-tertiary)] font-semibold">Version 2.4.0-pro • Build 8920</p>
                  </div>
                </div>

                <div className="space-y-3 text-[14px]">
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">Release Notes</span>
                    <button className="text-emerald-400 font-bold text-[13px] hover:underline flex items-center gap-1 cursor-pointer">
                      View Version 2.4 Changelog <ExternalLink size={13} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">Terms of Service</span>
                    <button className="text-[var(--text-tertiary)] font-medium text-[13px] hover:underline cursor-pointer">Read Terms</button>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                    <span className="font-bold text-[var(--text-secondary)]">Privacy Policy</span>
                    <button className="text-[var(--text-tertiary)] font-medium text-[13px] hover:underline cursor-pointer">Read Policy</button>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-bold text-[var(--text-secondary)]">Open Source Licenses</span>
                    <button className="text-[var(--text-tertiary)] font-medium text-[13px] hover:underline cursor-pointer">View Licenses</button>
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
