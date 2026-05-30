interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'lg';
}

export function StreakBadge({ streak, size = 'sm' }: StreakBadgeProps) {
  let colorClass = 'text-gray-400 bg-gray-900 border-gray-700';
  
  if (streak >= 30) {
    colorClass = 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 bg-gray-900 border-purple-500';
  } else if (streak >= 14) {
    colorClass = 'text-red-400 bg-red-900/30 border-red-800';
  } else if (streak >= 7) {
    colorClass = 'text-orange-400 bg-orange-900/30 border-orange-800';
  } else if (streak >= 3) {
    colorClass = 'text-amber-400 bg-amber-900/30 border-amber-800';
  }

  const text = size === 'lg' ? `🔥 ${streak} day streak` : `🔥 ${streak}`;
  const px = size === 'lg' ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs';

  return (
    <div className={`inline-flex items-center font-bold border rounded-full ${px} ${colorClass}`}>
      {streak >= 30 ? (
        <span className="flex items-center gap-1">
          <span className="text-white">🔥</span>
          <span className="bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 text-transparent">{streak} {size === 'lg' ? 'day streak' : ''}</span>
        </span>
      ) : (
        text
      )}
    </div>
  );
}