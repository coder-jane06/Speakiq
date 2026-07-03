# SpeakIQ Testing & Verification Guide

## 🎯 Testing Philosophy
Every phase MUST be tested and verified before moving to the next. No compromises.

## 📋 Pre-Flight Checklist (Run Before ANY Testing)

### 1. Backend Setup
```bash
cd backend

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify all dependencies
python setup_dependencies.py

# If any errors, fix them before proceeding
```

### 2. Environment Variables
Ensure `.env` file exists with:
```
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
GROQ_API_KEY=your_groq_key
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build  # Verify TypeScript compiles with ZERO errors
```

## 🧪 Phase 0: Current State Verification (CRITICAL)

### Test 0.1: Backend Starts Without Errors
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Expected**: 
- ✅ Server starts on http://localhost:8000
- ✅ Docs accessible at http://localhost:8000/docs
- ✅ No import errors in console
- ✅ "Supabase: connected" appears in logs

**If ANY errors**: STOP. Fix before proceeding.

### Test 0.2: Frontend Builds and Starts
```bash
cd frontend
npm run dev
```

**Expected**:
- ✅ No TypeScript errors
- ✅ App accessible at http://localhost:5173
- ✅ Homepage loads properly

### Test 0.3: Database Connection
1. Open http://localhost:8000/docs
2. Try `GET /topic` endpoint
3. **Expected**: Returns a topic object (not error)

### Test 0.4: Auth Flow
1. Open frontend
2. Try to sign up/login
3. **Expected**: Successful authentication

---

## 🎬 Phase 1 Testing: Core Recording → Analysis → Results Flow

### Test 1.1: Audio Recording Works
**Steps**:
1. Login to app
2. Navigate to Session page
3. Select Goal: "Orator"
4. Select Level: "Beginner"
5. Click "Start Session"
6. **Speak for 30-60 seconds about any topic**
7. Click "End & Analyze Session"

**Expected**:
- ✅ Microphone permission granted
- ✅ Recording indicator shows (red dot pulsing)
- ✅ Live waveform displays
- ✅ Timer counts down properly
- ✅ Stop button ends recording
- ✅ "Uploading recording..." message appears

**If recording fails**: Check browser console for MediaRecorder errors

### Test 1.2: Upload to Backend
**After recording stops**:

**Expected**:
- ✅ POST to `/sessions/upload` succeeds (check Network tab)
- ✅ Returns `session_id`
- ✅ Status changes to "Uploading..." then "Analyzing..."

**Check backend logs for**:
```
[sessions] Created session <uuid>
[sessions] Starting pipeline for <uuid>
```

### Test 1.3: Analysis Pipeline Runs
**Watch backend console for**:

**Expected sequence**:
```
[Pipeline] Starting analysis for session <uuid>
[Pipeline] Stage 1: Whisper transcription...
[WhisperService] Transcribing tmp_recording.webm...
[WhisperService] Done — X words, Y.Ys, language: en
[Pipeline] Stage 2a: Acoustic analysis...
[AcousticService] Analyzing: tmp_recording.webm
[AcousticService] Done — WPM: X, Pauses: Y
[Pipeline] Stage 2b: NLP analysis...
[NLPService] Done — Fillers: X, TTR: Y
[Pipeline] Stage 3: Generating coaching report...
[CoachingService] Report done — filler=X, delivery=Y
[Pipeline] Stage 4: Saving to Supabase...
[Pipeline] ✓ Pipeline complete for session <uuid>
```

**If ANY stage shows ERROR**:
- ❌ **Whisper error**: Check if faster-whisper is installed, audio file is valid
- ❌ **Acoustic error**: Check if ffmpeg is accessible, librosa is installed
- ❌ **NLP error**: Check if spaCy model is downloaded
- ❌ **Coaching error**: Check if GROQ_API_KEY is set

**Verify scores are non-zero**: Check logs for actual score values (not all 0s or 50s)

### Test 1.4: Results Page Displays
**After pipeline completes**:

**Expected**:
- ✅ Redirects to `/session/{id}/results`
- ✅ Loading screen shows for ~5 seconds
- ✅ Results page renders with:
  - Overall score (not 0)
  - Radar chart with 5 dimensions
  - "What went well" section with real feedback
  - "Priority fix" section with specific advice
  - Quantitative stats (WPM, filler count, etc.)

**If results show all 0s**: Pipeline failed silently. Check backend logs.

---

## 🎨 Phase 2 Testing: Enhanced Results Experience

### Test 2.1: New Endpoints Exist
**Backend health check**:
```bash
# In browser or curl
GET http://localhost:8000/sessions/{session_id}/transcript
GET http://localhost:8000/sessions/{session_id}/audio-url
```

**Expected**:
- ✅ `/transcript` returns array of word objects with `type: "filler" | "normal"`
- ✅ `/audio-url` returns `{ "url": "https://..." }` signed URL

### Test 2.2: New Results Components Render
**Frontend verification**:
1. Complete a session
2. Navigate to Results page
3. **Expected new components**:
   - ✅ Audio player with playback controls
   - ✅ Interactive transcript with clickable words
   - ✅ Filler words highlighted in red
   - ✅ Delivery diagnosis gauges
   - ✅ Filler breakdown bar chart

### Test 2.3: Audio Sync Works
**Steps**:
1. Click play on audio player
2. Transcript should highlight current word being spoken
3. Click a word in transcript
4. Audio should jump to that timestamp

**Expected**:
- ✅ Audio plays without errors
- ✅ Transcript follows along
- ✅ Clicking words seeks audio

---

## 🚀 Phase 3+ Testing: Advanced Features

*(To be defined after Phase 2 is verified)*

---

## 🐛 Common Issues & Fixes

### Issue: "Model not loaded" error
**Fix**: Run `python setup_dependencies.py` and install missing packages

### Issue: Audio file "Invalid data found when processing input"
**Fix**: Temp file handling issue. Already fixed in whisper_service.py and acoustic_service.py

### Issue: All scores are 0
**Fix**: Pipeline is failing silently. Check each analysis service logs.

### Issue: Frontend can't connect to backend
**Fix**: 
- Ensure backend is running on port 8000
- Check CORS settings in main.py
- Verify API_URL in frontend constants

### Issue: "Session not found" when polling
**Fix**: Session may not be created yet. Check POST /sessions/upload response.

---

## ✅ Success Criteria

### Phase 0 Complete When:
- [ ] Backend starts without errors
- [ ] Frontend builds without TypeScript errors
- [ ] Can login successfully
- [ ] Database connection works

### Phase 1 Complete When:
- [ ] Can record audio successfully
- [ ] Audio uploads to Supabase
- [ ] Pipeline processes audio completely
- [ ] Results page shows non-zero scores
- [ ] Coaching feedback is personalized (not fallback)

### Phase 2 Complete When:
- [ ] All Phase 2 endpoints work
- [ ] Audio player plays recorded audio
- [ ] Transcript syncs with audio
- [ ] All new components render
- [ ] No console errors

---

## 📝 Testing Log Template

```markdown
## Test Session: [Date]
**Phase**: Phase X
**Tester**: [Your Name]

### Environment
- OS: Windows 11
- Browser: Chrome 120
- Python: 3.12
- Node: 18.x

### Test Results
- [ ] Test 1.1: Recording works - PASS/FAIL
- [ ] Test 1.2: Upload works - PASS/FAIL
- [ ] Test 1.3: Pipeline completes - PASS/FAIL
- [ ] Test 1.4: Results display - PASS/FAIL

### Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Fix applied: [Description]

### Notes
[Any additional observations]
```

---

## 🎯 Next Steps After All Tests Pass

1. ✅ **Phase 0-1 Verified** → Proceed to Phase 2 implementation
2. ✅ **Phase 2 Verified** → Proceed to Phase 3 planning
3. ✅ **All Phases Verified** → Production deployment checklist
