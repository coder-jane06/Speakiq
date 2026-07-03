# Phase 2: Enhanced Results Experience - Execution Plan

## 🎯 Goal
Transform the Results page from static display to an **interactive learning tool** where users can:
- Play back their audio
- See exactly where they used filler words
- Click transcript words to jump to that moment
- Visualize delivery metrics
- Get actionable before/after examples

---

## 📦 Phase 2 Components Breakdown

### ✅ COMPLETED: Backend Endpoints
- [x] `GET /sessions/{id}/transcript` - Returns word list with semantic labels
- [x] `GET /sessions/{id}/audio-url` - Returns signed Supabase URL

### 🚧 TO BUILD: Frontend Components

#### 2.1 Audio Player Component
**File**: `frontend/src/components/results/AudioPlayer.tsx`
**Features**:
- Play/pause button
- Seek bar with time display
- Volume control
- Speed control (0.75x, 1x, 1.25x, 1.5x)
- Syncs with transcript highlighting

**Dependencies**: None (use HTML5 Audio API)

**Testing**:
- [ ] Audio loads without errors
- [ ] Play/pause works
- [ ] Seek bar is draggable
- [ ] Time display updates correctly
- [ ] Can control playback speed

---

#### 2.2 Transcript Viewer Component
**File**: `frontend/src/components/results/TranscriptViewer.tsx`
**Features**:
- Displays all words from transcript endpoint
- Color codes filler words (red underline)
- Highlights current word during playback (yellow background)
- Clicking a word seeks audio to that timestamp

**Data flow**:
```
Results page → fetch /transcript → TranscriptViewer
TranscriptViewer → onClick word → AudioPlayer.seekTo(time)
AudioPlayer → onTimeUpdate → TranscriptViewer updates highlight
```

**Testing**:
- [ ] All words render correctly
- [ ] Filler words have red styling
- [ ] Current word highlights during playback
- [ ] Clicking words seeks audio
- [ ] No performance lag with 500+ words

---

#### 2.3 Delivery Diagnosis Component
**File**: `frontend/src/components/results/DeliveryDiagnosis.tsx`
**Features**:
- Three circular gauge visualizations:
  - **Pace (WPM)**: Ideal range 130-150, shows user's WPM
  - **Pitch Variance**: Low = monotone, High = expressive
  - **Silence %**: Shows percentage of recording that was silent

**Data source**: `metrics` object from useCoachingReport hook

**Testing**:
- [ ] Gauges render with correct values
- [ ] Color coding (green = good, yellow = okay, red = needs work)
- [ ] Tooltips explain what each metric means
- [ ] Responsive on mobile

---

#### 2.4 Filler Breakdown Component
**File**: `frontend/src/components/results/FillerBreakdown.tsx`
**Features**:
- Horizontal bar chart showing top filler words
- Each bar shows word and count
- Sorted by frequency (most → least)
- Clicking a bar highlights all occurrences in transcript

**Data source**: `metrics.filler_detail` from API

**Example**:
```
um    ████████████ 12
like  ████████ 8
uh    █████ 5
```

**Testing**:
- [ ] Bars render proportionally
- [ ] Top 5-10 fillers shown
- [ ] Clicking bar highlights words in transcript
- [ ] Shows "No fillers detected" if count = 0

---

#### 2.5 Worst Moment Card Component
**File**: `frontend/src/components/results/WorstMomentCard.tsx`
**Features**:
- Highlights the sentence with highest filler density
- Shows before/after timestamp
- "Jump to moment" button
- Explains why this moment matters

**Data source**: Calculated from transcript + filler positions

**Testing**:
- [ ] Displays correct sentence
- [ ] "Jump to moment" seeks audio
- [ ] Explanation is helpful
- [ ] Only shows if fillers exist

---

#### 2.6 Sentence Rewrite Card Component
**File**: `frontend/src/components/results/SentenceRewriteCard.tsx`
**Features**:
- Shows 2-3 weak sentences from transcript
- Provides AI-suggested rewrites
- Side-by-side comparison

**Example**:
```
❌ "So um, I think, like, the main point is, uh, basically..."
✅ "The main point is..."
```

**Data source**: `coaching.transcript_highlights` from API

**Testing**:
- [ ] Shows 2-3 examples
- [ ] Rewrites are actually better
- [ ] Clear visual distinction between before/after
- [ ] Helpful for learning

---

## 🧪 Testing Strategy (Per Component)

### Step 1: Build Component in Isolation
- Create file
- Build basic structure
- Add TypeScript types
- Test with mock data

### Step 2: Integrate with Results Page
- Import component
- Pass real data from useCoachingReport hook
- Verify data flows correctly

### Step 3: Test User Interactions
- Click all buttons
- Verify state updates
- Check console for errors
- Test edge cases (no data, missing fields)

### Step 4: Visual Polish
- Ensure consistent with design system
- Test on mobile viewport
- Verify animations are smooth
- Check accessibility (keyboard navigation)

---

## 📅 Execution Order

### Day 1: Foundation
1. ✅ Backend endpoints (DONE)
2. 🔨 AudioPlayer component
3. 🔨 TranscriptViewer component
4. 🧪 Test audio sync

**Success Criteria**: Can play audio and click transcript words to seek

### Day 2: Visualizations
5. 🔨 DeliveryDiagnosis component
6. 🔨 FillerBreakdown component
7. 🧪 Test all gauges and charts

**Success Criteria**: All metrics display correctly

### Day 3: Advanced Features
8. 🔨 WorstMomentCard component
9. 🔨 SentenceRewriteCard component
10. 🧪 Full integration test

**Success Criteria**: All components work together seamlessly

### Day 4: Polish & Testing
11. 🎨 Visual refinement
12. 🧪 End-to-end user flow test
13. 🐛 Bug fixes
14. 📝 Documentation update

**Success Criteria**: Zero critical bugs, smooth UX

---

## 🚨 Blocking Issues to Watch For

### Issue #1: Audio File Access
**Problem**: Signed URLs expire after 1 hour
**Solution**: Generate new URL on demand if playback fails

### Issue #2: Transcript Sync Accuracy
**Problem**: Word timestamps may be slightly off
**Solution**: Use ±0.5s tolerance window for highlighting

### Issue #3: Performance with Long Transcripts
**Problem**: 1000+ words may cause lag
**Solution**: Virtualize transcript rendering (only render visible words)

### Issue #4: Mobile Responsiveness
**Problem**: Audio player controls too small on mobile
**Solution**: Larger touch targets, simplified UI on small screens

---

## ✅ Phase 2 Completion Checklist

- [ ] All 6 components built and tested individually
- [ ] Components integrated into Results.page.tsx
- [ ] Audio playback works flawlessly
- [ ] Transcript sync is accurate (within 0.5s)
- [ ] All visualizations render correctly
- [ ] No TypeScript errors
- [ ] No console errors during usage
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested on mobile viewport
- [ ] Passed full end-to-end user test
- [ ] Code reviewed for quality
- [ ] Documentation updated

**When all checkboxes are checked**: ✅ **PHASE 2 COMPLETE** → Proceed to Phase 3

---

## 🎯 Phase 3 Preview (Coming Next)

After Phase 2 verification:
- Historical progress charts
- Comparison with previous sessions
- Drill completion tracking
- Personalized challenges
- Advanced analytics dashboard

**Do NOT start Phase 3 until Phase 2 is rock solid.**
