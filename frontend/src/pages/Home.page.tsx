import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Zap, Target, Mic } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <main className="min-h-[85vh] flex flex-col items-center justify-center p-6 bg-primary animate-fadeSlideUp relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
        <div className="w-[800px] h-[800px] bg-[var(--accent)]/10 rounded-full blur-[120px] animate-pulse-orb"></div>
      </div>

      <div className="relative z-10 w-full max-w-[1060px] flex flex-col items-start gap-12">
        
        <div className="flex flex-col gap-6 max-w-[600px]">
          <h1 className="text-[48px] md:text-[64px] font-[700] text-primary tracking-[-0.04em] leading-[1.05]">
            Start speaking.<br />Start improving.
          </h1>
          <p className="text-[18px] text-secondary font-medium leading-relaxed max-w-[480px]">
            Your daily voice analysis awaits. Practice for just 3 minutes a day and let AI analyze your delivery, structure, and vocabulary.
          </p>
          
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => navigate(user ? ROUTES.SESSION : ROUTES.LOGIN)}
              className="bg-[var(--accent)] text-[var(--bg-base)] font-bold text-[16px] px-8 py-4 rounded-full shadow-[0_0_20px_var(--accent-glow)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              Start Session
              <Mic size={18} />
            </button>
            <span className="text-[13px] text-tertiary font-bold tracking-widest uppercase">Takes &lt; 3 Min</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-10">
          <div className="card border-[var(--border)] bg-[var(--bg-card)] p-8 hover:border-[var(--border-md)] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
              <Zap size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-[18px] font-bold text-primary mb-2">AI Analysis</h3>
            <p className="text-[14px] text-secondary font-medium leading-relaxed">Get instant feedback on your delivery, structure, and vocabulary from our advanced AI.</p>
          </div>

          <div className="card border-[var(--border)] bg-[var(--bg-card)] p-8 hover:border-[var(--border-md)] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center mb-6">
              <Target size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-[18px] font-bold text-primary mb-2">Daily Drills</h3>
            <p className="text-[14px] text-secondary font-medium leading-relaxed">Personalized exercises designed to improve your weakest areas and reinforce your strengths.</p>
          </div>

          <div className="card border-[var(--border)] bg-[var(--bg-card)] p-8 hover:border-[var(--border-md)] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
              <TrendingUp size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-[18px] font-bold text-primary mb-2">Streak System</h3>
            <p className="text-[14px] text-secondary font-medium leading-relaxed">Build consistency with daily streaks, habit tracking, and visualized progress metrics.</p>
          </div>
        </div>
        
      </div>
    </main>
  );
}