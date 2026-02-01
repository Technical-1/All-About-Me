# Chat API Test Results

Generated: Sun Feb 1 02:31:40 EST 2026

## Summary

- **Passed:** 30
- **Failed:** 0
- **Total:** 30
- **Pass Rate:** 100%

---

## Test Categories

### Personal Info (7 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| Where does Jacob work? | ✅ PASSED | 2/2 (Deloitte, Engineering Solutions Analyst) |
| What is Jacob's current job? | ✅ PASSED | 2/2 |
| Tell me about Jacob's background | ✅ PASSED | 2/2 (University of Florida, Computer Engineering) |
| Where did Jacob go to school? | ✅ PASSED | 1/1 (University of Florida) |
| What degree does Jacob have? | ✅ PASSED | 2/2 (Computer Engineering, Bachelor) |
| How can I contact Jacob? | ✅ PASSED | 2/2 (email, jacobkanfer) |
| What is Jacob's email? | ✅ PASSED | 1/1 (jacobkanfer8@gmail.com) |

### Skills (5 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| What programming languages does Jacob know? | ✅ PASSED | 2/2 (Python, JavaScript) |
| Does Jacob know Python? | ✅ PASSED | 1/1 |
| What frameworks does Jacob use? | ✅ PASSED | 2/2 (React, Vue) |
| Does Jacob have AWS experience? | ✅ PASSED | 1/1 |
| What certifications does Jacob have? | ✅ PASSED | 2/2 (AWS, Cloud Practitioner) |

### Experience (6 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| What was Jacob's internship? | ✅ PASSED | 2/2 (World Wide Technology, Data Science) |
| Tell me about World Wide Technology | ✅ PASSED | 3/3 |
| What leadership roles has Jacob had? | ✅ PASSED | 2/2 (Student Government, Chief of Staff) |
| Was Jacob in student government? | ✅ PASSED | 2/2 |
| What awards has Jacob won? | ✅ PASSED | 2/2 (Florida Blue Key, Stratton) |
| Tell me about the AHSR project | ✅ PASSED | 4/4 (AHSR, robot, autonomous, hospital) |

### Projects (5 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| What projects has Jacob built? | ✅ PASSED | 2/2 (BTC Explorer, Git Archiver) |
| Tell me about BTC Explorer | ✅ PASSED | 2/2 (Bitcoin, blockchain) |
| How does Git Archiver work? | ✅ PASSED | 2/2 (Git, archive) |
| What is the Differential Growth project? | ✅ PASSED | 2/2 (Differential Growth, algorithm) |
| Tell me about Jacob's open source work | ✅ PASSED | 2/2 (GitHub, open source) |

### Blog (3 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| Has Jacob written any blog posts? | ✅ PASSED | 3/3 (blog, WebLLM, RAG) |
| How did Jacob build the AI assistant for his portfolio? | ✅ PASSED | 3/3 (WebLLM, embeddings, RAG) |
| What is Claude Code? | ✅ PASSED | 2/2 (Claude Code, AI) |

### Edge Cases (4 tests) ✅
| Query | Result | Keywords Found |
|-------|--------|----------------|
| Who is Jacob? | ✅ PASSED | 2/2 (Jacob Kanfer, Deloitte) |
| What can you tell me about Jacob Kanfer? | ✅ PASSED | 1/2 |
| Is Jacob available for hire? | ✅ PASSED | 2/2 (contact, email) |
| What technologies does Jacob specialize in? | ✅ PASSED | 1/2 (AI, Python) |

---

## Changes Made to Fix RAG Issues

### 1. Lowered Similarity Threshold
- Changed `minScore` from `0.35` to `0.20` in `src/lib/rag-server.ts`
- Increased `topK` from `6` to `8` for more context

### 2. Added Keyword-Based Boosting
Implemented hybrid search that boosts chunks containing exact keywords from the query:
- Longer keywords (>4 chars) get +0.15 boost
- Shorter keywords get +0.08 boost
- Catches acronyms (AHSR), proper nouns (World Wide Technology), etc.

### 3. Improved Personal Content
Added searchable phrases in content files:
- `bio.md`: Added "What degree does Jacob have?" section
- `experience.md`: Added "Where Jacob Works" section, improved AHSR and WWT descriptions
- `skills.md`: Consolidated certifications into single searchable chunk
- `projects-summary.md`: New file with project overview and blog post summaries

### 4. Updated API Model
Changed from deprecated `claude-3-5-haiku-20241022` to `claude-3-haiku-20240307`

---

## Files Modified

- `src/lib/rag-server.ts` - Hybrid search with keyword boosting
- `src/pages/api/chat.ts` - Updated model
- `public/data/personal/bio.md` - Added education searchability
- `public/data/personal/experience.md` - Added job, internship, AHSR searchability
- `public/data/personal/skills.md` - Consolidated certifications
- `public/data/personal/projects-summary.md` - New project/blog overview

---

## How to Run Tests

```bash
# Start the dev server
npm run dev

# Run the test suite
./scripts/test-chat-api.sh
```

The test script will:
1. Send 30 queries to the Chat API
2. Check each response for expected keywords
3. Generate a pass/fail report
4. Write detailed results to this file
