# Digital Signage - QA Metrics Tracking

**Purpose**: Track quality metrics week-by-week to monitor progress toward quality gates and identify trends.

**Owner**: QALead  
**Review Frequency**: Weekly (every Friday)  
**Baseline Date**: 2026-06-05

---

## Test Coverage Metrics

### Weekly Coverage Tracking

| Week | Date | Statements | Branches | Functions | Lines | Tests Passing | Notes |
|------|------|-----------|----------|-----------|-------|---------------|-------|
| **Baseline** | 2026-06-05 | 36.59% | 14.28% | 39.21% | 32.87% | 9/10 | Initial audit complete |
| Week 1 | TBD | — | — | — | — | — | Awaiting test expansion |
| Week 2 | TBD | — | — | — | — | — | |
| Week 3 | TBD | — | — | — | — | — | |
| Week 4 | TBD | — | — | — | — | — | Target: 50% statements |

### Coverage Gap Analysis

**Current Gap to Target (70%)**:
```
Statements:  36.59% → 70% = +33.41 percentage points needed
Branches:    14.28% → 60% = +45.72 percentage points needed
Functions:   39.21% → 70% = +30.79 percentage points needed
Lines:       32.87% → 70% = +37.13 percentage points needed
```

**Estimated Effort**:
- Lines of test code needed: ~1,500 lines
- Number of test cases: ~60-80 integration tests
- Hours of work: 40-60 hours
- Team allocation: 1 QualityEngineer (2-3 weeks)

---

## API Endpoint Coverage Status

### Test Coverage by Route

| Route | Module | Current Coverage | Target | Status | Priority |
|-------|--------|------------------|--------|--------|----------|
| **/auth/** | middleware | 0% | 70% | ❌ NONE | CRITICAL |
| **/playlists/** | routes/playlists | 0% | 70% | ❌ NONE | HIGH |
| **/screens/** | routes/screens | 0% | 70% | ❌ NONE | HIGH |
| **/media/** | routes/media | 21.52% | 70% | ❌ LOW | MEDIUM |
| **/schedules/** | routes/schedules | 18.42% | 70% | ❌ LOW | MEDIUM |
| **/utils/** | utils/* | 100% (logger) | 70% | ✓ GOOD | — |

**Highest Priority Routes**:
1. Auth endpoints (0% → 70% = 8-10 tests)
2. Playlist management (0% → 70% = 15-20 tests)
3. Screen registration (0% → 70% = 10-12 tests)

---

## Quality Gate Metrics

### Release Approval Gates

| Gate | Metric | Current | Target | Status |
|------|--------|---------|--------|--------|
| Unit Test Coverage | Statements ≥70% | 36.59% | 70% | ❌ FAIL |
| API Test Coverage | Routes ≥70% | 0% | 70% | ❌ FAIL |
| E2E Tests Pass | All specs pass | N/A | 100% | ⚠️ NOT RUN |
| P0 Bugs | Count | 1 | 0 | ❌ CRITICAL |
| P1 Bugs | Count | 0 | 0 | ✓ PASS |
| Security Issues | Count | 1 (default password) | 0 | ❌ FAIL |
| Code Review | Approved | ? | Yes | ⚠️ PENDING |
| Performance | <5s test suite | ~3s | <5s | ✓ PASS |

**Release Status**: ❌ **NOT APPROVED** (3 critical gates failing)

---

## Bug Tracking

### Open Bugs by Severity

#### P0 (Critical) - Blocks Release

| ID | Title | Component | Status | Fix ETA |
|----|-------|-----------|--------|---------|
| SEC-001 | Default admin password = 'admin' | Config | 🔴 OPEN | IMMEDIATE |

**Action**: Must fix before any production deployment

#### P1 (High) - Must Fix

| ID | Title | Component | Status | Fix ETA |
|----|-------|-----------|--------|---------|
| — | (None currently) | — | — | — |

#### P2 (Medium) - Should Fix

| ID | Title | Component | Status | Fix ETA |
|----|-------|-----------|--------|---------|
| BUG-001 | parseFps('') returns 0 instead of null | utils/parseFps | 🟡 OPEN | Week 1 |

**Action**: Fix in next sprint, add test to prevent regression

#### P3 (Low) - Nice to Have

| ID | Title | Component | Status | Fix ETA |
|----|-------|-----------|--------|---------|
| — | (None currently) | — | — | — |

**Total Open Bugs**: 2 (1 P0, 1 P2)

---

## Test Execution Health

### Weekly Test Run Metrics

| Week | Total Tests | Passing | Failing | Flaky | Exec Time | Notes |
|------|------------|---------|---------|-------|-----------|-------|
| Week 0 (Baseline) | 10 | 9 | 1 | 0 | ~3s | Initial suite only |
| Week 1 | — | — | — | — | — | Awaiting expansion |
| Week 2 | — | — | — | — | — | |
| Week 3 | — | — | — | — | — | Target: <5s total |

**Flaky Test Trend**: Aiming for 0 flaky tests (retries = 0)

---

## Performance Metrics

### Application Performance Baseline

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Backend startup time | < 2s | < 3s | ✓ GOOD |
| Database init time | < 1s | < 2s | ✓ GOOD |
| Health endpoint latency | < 10ms | < 50ms | ✓ GOOD |
| API response time (p50) | TBD | < 200ms | ⏳ TBD |
| API response time (p95) | TBD | < 500ms | ⏳ TBD |
| Test execution time | ~3s | < 5s | ✓ GOOD |

**Notes**: Need to measure API latency under load (Task #6)

---

## Deployment & Operations Metrics

### Production Health

| Metric | Status | Notes |
|--------|--------|-------|
| Service running | ✓ UP | systemd digital-signage.service |
| Health check | ✓ 200 OK | /health endpoint responsive |
| Database | ✓ OK | No corruption, WAL mode enabled |
| Data persistence | ✓ OK | Volumes mounted correctly |
| Log rotation | ? TBD | Need to verify cron job |
| Backup success | ? TBD | Need to test backup script |

---

## Quality Trend Analysis

### Coverage Trend (Forecast)

**Goal**: Reach 70% coverage by Week 4-6

```
Week 0 (Baseline):  36.59% ██████░░░░░░░░░░░░░░░░░░░░░░░░ (53% of target)
Week 1 (Projected): 45%    ████████░░░░░░░░░░░░░░░░░░░░░░░░ (64% of target)
Week 2 (Projected): 55%    █████████░░░░░░░░░░░░░░░░░░░░░░░░ (79% of target)
Week 3 (Projected): 62%    ██████████░░░░░░░░░░░░░░░░░░░░░░░ (89% of target)
Week 4 (Target):    70%    ████████████░░░░░░░░░░░░░░░░░░░░░ (100% of target)
```

**Assumptions**:
- 1 QualityEngineer working 30 hrs/week on test writing
- ~10% coverage gain per week with 20-30 tests added
- Linear progress (no major blockers)

---

## Escalation Points

### When to Escalate to CTO

| Situation | Trigger | Action |
|-----------|---------|--------|
| Coverage declining | Trend down for 2+ weeks | Review team capacity, code changes |
| P0 bugs in production | Any P0 found after release | Incident review, post-mortem |
| Release blocked | ≥2 critical gates failing | Plan remediation, adjust timeline |
| Resource conflict | Competing demands on QualityEngineer | Prioritize backlog with CTO |
| External blocker | Blocked on infrastructure, CI/CD | Escalate infrastructure team |

---

## Weekly Review Checklist

**Every Friday, QALead should:**

### 1. Collect Metrics (15 min)
```bash
# Run coverage report
cd /var/www/digital-signage-app/backend
npm test -- --coverage > coverage-report.txt

# Extract key metrics
grep "% Stmts" coverage-report.txt
grep "% Branch" coverage-report.txt
```

### 2. Update Tracking Sheet (10 min)
- [ ] Enter new week's coverage metrics
- [ ] Count tests passing/failing
- [ ] Note any new bugs found
- [ ] Record test execution time

### 3. Analyze Trends (15 min)
- [ ] Compare to previous week
- [ ] Check if trending toward 70% target
- [ ] Identify any regressions
- [ ] Review bug list for escalations

### 4. Report & Communicate (15 min)
- [ ] Email summary to engineering lead
- [ ] Flag any blockers to CTO
- [ ] Update Slack #qa channel
- [ ] Plan next week's focus

### 5. Update Roadmap (10 min)
- [ ] Adjust Week N projections if needed
- [ ] Plan task assignments for QualityEngineer
- [ ] Identify any prep work for PlatformEngineer (CI/CD)

**Total time per week**: ~1 hour for QALead

---

## Example Weekly Report Template

```
Subject: QA Metrics - Week N Report

Coverage Update:
- Statements: 36.59% → 42% (+5.41 points) ✓
- Branches: 14.28% → 18% (+3.72 points) ✓
- Tests: 10 → 28 (+18 new tests) ✓

On Track for 70% by: Week 4 (2026-07-03)

Open Issues:
- P0: Default admin password (CRITICAL)
- P2: parseFps bug (fix underway)
- 0 P1 bugs

Blockers: None

Next Week Plan:
- Add auth endpoint tests (8 tests)
- Add playlist CRUD tests (10 tests)
- Setup CI/CD pipeline (PlatformEngineer)

Release Status: Not ready (2 gates failing)
```

---

## Metrics Data Repository

**Location**: `/var/www/digital-signage-app/`

Files to maintain:
- `QA_METRICS_TRACKING.md` (this file) - updated weekly
- `QA_FINDINGS_REPORT.md` - updated with new issues
- Coverage reports: `coverage/` directory (auto-generated by jest)
- Test results: `test-results.json` (if CI configured)

---

## Success Criteria

✓ **This week**: Establish baseline and tracking process  
✓ **Week 1-2**: Begin API test writing, reach 45% coverage  
✓ **Week 3-4**: Reach 60% coverage, implement CI/CD  
✓ **Week 5-6**: Reach 70% coverage, enforce gates  
✓ **Week 7+**: Maintain 70%+, trend toward 80%

---

**Tracking Started**: 2026-06-05  
**Next Update**: 2026-06-12 (Friday)  
**Review Frequency**: Weekly
