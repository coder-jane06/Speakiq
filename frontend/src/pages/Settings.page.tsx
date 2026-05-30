import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, MonitorSmartphone, Shield, HelpCircle, Bell } from 'lucide-react';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="min-h-[85vh] flex flex-col items-center justify-start pt-12 pb-20 p-6 bg-primary animate-fadeSlideUp">
      <div className="w-full max-w-[800px] flex flex-col gap-8">
        
        <header className="mb-2">
          <h1 className="text-[36px] font-[700] text-primary tracking-tight mb-2">Settings</h1>
          <p className="text-secondary font-medium text-[16px]">Manage your account preferences and app behavior.</p>
        </header>
        
        {/* APPEARANCE */}
        <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-2 shadow-sm">
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <h2 className="text-[14px] font-bold text-tertiary uppercase tracking-widest flex items-center gap-2">
              <MonitorSmartphone size={16} /> Appearance
            </h2>
          </div>
          
          <div className="p-6 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors rounded-b-[var(--radius-lg)]">
            <div>
              <p className="text-primary font-semibold text-[16px] mb-1">Color Theme</p>
              <p className="text-[14px] text-secondary font-medium">Toggle between light and dark mode</p>
            </div>
            
            <button
              onClick={toggleTheme}
              className="relative flex items-center gap-2 bg-[var(--bg-card-active)] border border-[var(--border)] text-primary px-4 py-2.5 rounded-full text-[14px] font-bold hover:border-[var(--border-md)] active:scale-95 transition-all shadow-sm"
            >
              {theme === 'dark' ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-amber-500" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </button>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-2 shadow-sm">
          <div className="px-6 py-5 border-b border-[var(--border)]">
            <h2 className="text-[14px] font-bold text-tertiary uppercase tracking-widest flex items-center gap-2">
              <Bell size={16} /> Notifications
            </h2>
          </div>
          
          <div className="p-6 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors rounded-b-[var(--radius-lg)] cursor-not-allowed opacity-60">
            <div>
              <p className="text-primary font-semibold text-[16px] mb-1">Daily Practice Reminder</p>
              <p className="text-[14px] text-secondary font-medium">Keep your streak alive with a gentle nudge</p>
            </div>
            
            <div className="w-12 h-6 bg-[var(--border-md)] rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
        </section>

        {/* PRIVACY & HELP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-interactive flex items-start gap-4 p-6">
             <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center shrink-0">
               <Shield size={20} strokeWidth={2.5} />
             </div>
             <div>
               <h3 className="text-primary font-bold text-[16px] mb-1">Data & Privacy</h3>
               <p className="text-secondary text-[13px] font-medium leading-relaxed">Your audio recordings are analyzed securely and never shared with third parties.</p>
             </div>
          </div>
          
          <div className="card-interactive flex items-start gap-4 p-6">
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
               <HelpCircle size={20} strokeWidth={2.5} />
             </div>
             <div>
               <h3 className="text-primary font-bold text-[16px] mb-1">Help & Support</h3>
               <p className="text-secondary text-[13px] font-medium leading-relaxed">Having trouble with your microphone or analysis? View our troubleshooting guide.</p>
             </div>
          </div>
        </div>

      </div>
    </main>
  );
}
