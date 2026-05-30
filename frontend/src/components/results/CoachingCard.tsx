// =============================================================
// frontend/src/components/results/CoachingCard.tsx
//
// Displays one section of the coaching report.
// Used for: what went well, priority fix, example, drill.
// =============================================================

interface CoachingCardProps {
  icon:     string
  label:    string
  content:  string
  accent?:  string   // border color
}

export function CoachingCard({
  icon, label, content, accent = 'var(--border-dark)'
}: CoachingCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid var(--bg-card-border)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: '0 14px 14px 0',
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.08em'
        }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: 14, color: '#ccc',
        lineHeight: 1.6, margin: 0,
      }}>
        {content}
      </p>
    </div>
  )
}
