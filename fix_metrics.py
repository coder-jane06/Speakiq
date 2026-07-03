import re

# 1. Update useCoachingReport.ts
with open("frontend/src/hooks/useCoachingReport.ts", "r", encoding="utf-8") as f:
    content = f.read()

replacement = """
        // Parse coaching_report if JSON string
        const coachingData = typeof rawMetrics.coaching_report === 'string'
          ? JSON.parse(rawMetrics.coaching_report)
          : rawMetrics.coaching_report

        // Safe JSON parse helper
        const parseJson = (val: any, fallback: any) => {
          if (typeof val === 'string') {
            try { return JSON.parse(val) } catch { return fallback }
          }
          return val || fallback
        }

        const fillerDetail = parseJson(rawMetrics.filler_detail, {})
        const words = parseJson(rawMetrics.words, [])
        const pauseList = parseJson(rawMetrics.pause_list, [])
        
        // Construct duration_s from last word's end timestamp
        const duration_s = words.length > 0 ? words[words.length - 1].end : 0
        
        // Prepare filler_occurrences for FillerBreakdown
        // Convert fillerDetail (e.g. {"actually": 2}) to FillerOccurrence[]
        const filler_words = Object.entries(fillerDetail).map(([word, count]) => ({
          word,
          count,
          timestamps: [] // We could extract from filler_positions if needed, but count is sufficient for breakdown
        }))

        if (import.meta.env.DEV) {
          console.log('[Poll] SUCCESS - coaching report loaded')
        }
        
        setSession(data)
        setMetrics({ 
          ...rawMetrics, 
          filler_detail: fillerDetail,
          words,
          pause_list: pauseList,
          duration_s,
          filler_words
        })
        setCoaching(coachingData)
        setLoading(false)
"""

content = re.sub(
    r'// Parse coaching_report if JSON string.*setLoading\(false\)',
    replacement.strip(),
    content,
    flags=re.DOTALL
)

with open("frontend/src/hooks/useCoachingReport.ts", "w", encoding="utf-8") as f:
    f.write(content)

# 2. In Results.page.tsx, ensure duration_s and filler_words are properly fetched from metrics.
with open("frontend/src/pages/Results.page.tsx", "r", encoding="utf-8") as f:
    results = f.read()

# Replace any metrics?.duration_secs with metrics?.duration_s
results = results.replace("metrics?.duration_secs", "metrics?.duration_s")

with open("frontend/src/pages/Results.page.tsx", "w", encoding="utf-8") as f:
    f.write(results)

print("Fixed useCoachingReport.ts and Results.page.tsx parsing!")
