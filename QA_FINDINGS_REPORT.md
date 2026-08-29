# Digital Signage - QA Findings Report

**Report Date**: 2026-06-05  
**QA Lead**: QALead (e4603e5b-33bd-41a4-a24b-061db4fa8b48)  
**Baseline Coverage Audit**: COMPLETED  

---

## Executive Summary

The Digital Signage application has a baseline test coverage of **36.59%**, significantly below the QA target of **70%**. One bug was identified in the FPS parsing utility, and a critical security issue was found (default admin password). The application infrastructure is functional and deployable, but the testing strategy needs improvement to meet quality gates.

**Status**: ⚠️ Below quality bar - recommend addressing critical findings before next release.

---

## 1. Test Coverage Baseline

### 1.1 Overall Coverage Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statements | 36.59% | ≥70% | ❌ BELOW |
| Branches | 14.28% | ≥60% | ❌ BELOW |
| Functions | 39.21% | ≥70% | ❌ BELOW |
| Lines | 32.87% | ≥70% | ❌ BELOW |

**Gap Analysis**:
- **33.41 percentage points** below statement coverage target
- Branch coverage critically low (14.28% vs 60% target)
- Requires ~1500+ additional lines of test code to reach 70%

### 1.2 Test Execution Results

```
Test Suites: 2 (1 passing, 1 failing)
Tests:       9 passing, 1 failing
Time:        ~3 seconds
Environment: Backend only (frontend E2E not yet integrated)
```

**Passing**:
- ✓ src/utils/schedule.test.ts (5 tests)

**Failing**:
- ✗ src/utils/parseFps.test.ts (1 failing test out of 5)

### 1.3 Coverage by Module

| Module | Coverage | Notes |
|--------|----------|-------|
| db/schema.ts | **72.34%** | ✓ Only module above target |
| routes/media.ts | **21.52%** | ❌ API endpoints poorly tested |
| routes/schedules.ts | **18.42%** | ❌ Scheduling logic missing tests |
| utils/logger.ts | **100%** | ✓ Fully covered |
| utils/parseFps.ts | N/A | Has bug (see section 2) |

**Key Finding**: API route handlers have minimal test coverage. Media and scheduling routes are <25% covered.

---

## 2. Bugs Found

### 2.1 BUG: parseFps Utility - Empty String Handling

**Severity**: P2 (Medium) - Edge case bug  
**Component**: `src/utils/parseFps.ts`  
**Test**: `src/utils/parseFps.test.ts` (Line 17)

**Issue**:
```typescript
parseFps('') returns 0 instead of null
```

**Expected Behavior**:
- Empty string input should return `null`
- Indicates missing or invalid FPS value

**Actual Behavior**:
- Empty string input returns `0`
- Could lead to incorrect frame rate calculations

**Impact**:
- Media processing: incorrect video dimensions/timing
- Playlist: frames calculated as 0 fps (invalid)
- User experience: potential video quality degradation

**Root Cause**: Function does not validate empty string before parsing

**Recommended Fix** (1-line):
```typescript
if (!fps || fps.trim() === '') return null;  // Add at line 12
```

**Priority**: Should be fixed before next release  
**Effort**: < 5 minutes (1-line fix + test pass)

---

## 3. Security Findings

### 3.1 CRITICAL: Default Admin Credentials

**Severity**: P0 (Critical) - Security Risk  
**Finding**: `ADMIN_PASSWORD` environment variable set to default value `'admin'`

**Location**: Backend environment configuration  
**Evidence**: Console warning on startup:
```
[SECURITY WARNING] ADMIN_PASSWORD is set to the default value "admin". 
Set a strong password in .env before production use.
```

**Risk**:
- Admin account accessible with well-known default credentials
- Unauthorized users can access all admin functions
- Can create/modify playlists, delete media, configure screens
- **Do not deploy to production without fixing**

**Remediation**:
1. Generate strong password: `openssl rand -hex 16` → 32-character hex string
2. Update `.env`: `ADMIN_PASSWORD=<strong-password>`
3. Verify warning gone on next startup
4. Document password securely (password manager)

**Timeline**: **BEFORE PRODUCTION DEPLOYMENT**

### 3.2 Additional Security Observations

- ✓ JWT secret configuration exists (not using default)
- ✓ CORS origin can be restricted (currently allows all for dev)
- ⚠️ Rate limiting configuration: verify in production `.env`
- ⚠️ File upload validation: ensure FFmpeg validates all inputs

---

## 4. Test Coverage Gaps

### 4.1 Missing API Endpoint Tests

The following critical API endpoints have **zero test coverage**:

**Authentication Endpoints** (CRITICAL):
- [ ] POST /api/auth/login
- [ ] POST /api/auth/logout
- [ ] POST /api/auth/refresh-token
- [ ] GET /api/auth/verify

**Playlist Endpoints** (HIGH):
- [ ] GET /api/playlists
- [ ] POST /api/playlists (create)
- [ ] PATCH /api/playlists/:id (update)
- [ ] DELETE /api/playlists/:id
- [ ] POST /api/playlists/:id/media (add to playlist)

**Screen Endpoints** (HIGH):
- [ ] GET /api/screens
- [ ] POST /api/screens (register)
- [ ] PATCH /api/screens/:id (update)
- [ ] DELETE /api/screens/:id
- [ ] GET /api/screens/:id/status

**Media Endpoints** (MEDIUM):
- [ ] GET /api/media
- [ ] POST /api/media (upload)
- [ ] DELETE /api/media/:id
- [ ] POST /api/media/:id/process (FFmpeg)

**Estimate**: ~60-80 test cases needed to cover these endpoints (assuming 5-8 tests per endpoint for happy path + error scenarios)

### 4.2 Missing Utility Function Tests

Identified but not yet tested:
- [ ] Date/time scheduling logic
- [ ] Playlist transition calculations
- [ ] Media duration parsing
- [ ] FFmpeg command construction
- [ ] Error handling in routes

### 4.3 Missing Integration Tests

- [ ] Database transaction rollback scenarios
- [ ] Concurrent uploads (stress test)
- [ ] File system edge cases (disk full, permission denied)
- [ ] Network timeout handling
- [ ] Graceful degradation (missing files, etc.)

---

## 5. Code Quality Observations

### 5.1 Strengths

✓ **TypeScript**: Full type coverage in codebase (no `any` types observed)  
✓ **Project Structure**: Well-organized routes/utils/db separation  
✓ **Dependency Management**: Modern packages, security patches applied  
✓ **Environment Configuration**: Proper .env pattern for secrets  
✓ **Deployment**: Working systemd service and Docker setup

### 5.2 Areas for Improvement

⚠️ **Test Organization**: Tests scattered (some in `__tests__/`, some in `utils/`)  
⚠️ **Test Naming**: Inconsistent describe/it block naming  
⚠️ **Mocking**: No mock framework detected for database tests (live DB)  
⚠️ **Fixtures**: No test data fixtures for common scenarios  
⚠️ **CI/CD**: No automated test pipeline detected

---

## 6. Performance Observations

### 6.1 Test Execution Performance

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| Total time | ~3 seconds | <5 sec | ✓ GOOD |
| Tests per second | 3.3 | >2 | ✓ GOOD |

### 6.2 Application Performance (Baseline)

Observations during testing:
- Backend startup: < 2 seconds
- Database initialization: < 1 second
- First request latency: < 100ms
- Health check response: < 10ms

---

## 7. Recommendations

### 7.1 Immediate Actions (Week 1)

**Priority 1 - Security**:
1. [ ] Fix default admin password (CRITICAL)
2. [ ] Verify rate limiting enabled in production config
3. [ ] Audit file upload validation

**Priority 2 - Bug Fix**:
4. [ ] Fix parseFps empty string bug (5 minutes)
5. [ ] Run full test suite to verify no regressions

**Priority 3 - Documentation**:
6. [ ] Document test coverage baseline in DEVELOPMENT.md
7. [ ] Update QA procedures for release gate

### 7.2 Short Term (Weeks 2-4)

**Add API Integration Tests** (Supertest + Jest):
- [ ] Auth endpoints: 8-10 tests (login, logout, token refresh)
- [ ] Playlist endpoints: 15-20 tests (CRUD operations)
- [ ] Screen endpoints: 10-12 tests (registration, status)
- [ ] Media endpoints: 10-15 tests (upload, delete, process)

**Estimated effort**: 40-60 hours of test writing

**Target**: 55-60% coverage on backend

### 7.3 Medium Term (Weeks 4-8)

**Setup CI/CD Pipeline**:
- [ ] GitHub Actions / GitLab CI configuration
- [ ] Automated test execution on every PR
- [ ] Coverage report generation and trending
- [ ] Quality gate enforcement (fail on <70%)

**Add Frontend E2E Tests** (Playwright):
- [ ] Admin UI workflows (login, create playlist, upload media)
- [ ] Kiosk playback screens
- [ ] Error scenarios

### 7.4 Long Term (Weeks 8+)

**Advanced Testing**:
- [ ] Performance benchmarks (load test, stress test)
- [ ] Security audit (OWASP Top 10)
- [ ] Accessibility testing (WCAG 2.1 AA)
- [ ] Visual regression testing

---

## 8. Quality Gate Status

### Release Approval Checklist

Current Status: ❌ **NOT READY FOR PRODUCTION**

| Gate | Status | Notes |
|------|--------|-------|
| Unit test coverage ≥70% | ❌ 36.59% | 33 points below target |
| API integration tests exist | ❌ None | 0/60 tests written |
| E2E tests pass | ⚠️ Not run | Not yet configured |
| P0 bugs fixed | ❌ Default admin | Must fix before release |
| Security review | ⚠️ Partial | Identified 1 critical, 0 p1 |
| Performance validated | ⚠️ Baseline | Need load testing |
| Code review approved | ? Unknown | Assume pending |
| CHANGELOG updated | ? Unknown | Assume pending |

**Recommendation**: Continue development. Do not release to production until:
1. Default admin password changed
2. Coverage reaches ≥70% (add ~1500 lines of tests)
3. All quality gates passed

---

## 9. Metrics & Tracking

### 9.1 Coverage Trend (Starting Point)

| Metric | Initial | Target | Gap |
|--------|---------|--------|-----|
| Statements | 36.59% | 70% | -33.41 |
| Branches | 14.28% | 60% | -45.72 |
| Functions | 39.21% | 70% | -30.79 |

### 9.2 Success Metrics Going Forward

- [ ] Coverage trend: increasing week over week
- [ ] Bug escape rate: < 3 bugs per release in production
- [ ] Test execution time: < 5 minutes (automated)
- [ ] P0 bugs before release: zero
- [ ] Release cycle time: < 1 day (gated by QA)

---

## 10. Next Steps

**By QualityEngineer**:
1. Begin writing API integration tests (Supertest)
2. Expand existing utility tests
3. Document test patterns and fixtures for consistency
4. Set up code coverage tracking

**By Engineering Lead**:
1. Review and approve test structure changes
2. Allocate time for test writing in sprint planning
3. Enforce test coverage in code review

**By DevOps/PlatformEngineer**:
1. Configure GitHub Actions / GitLab CI
2. Set up coverage reporting and dashboard
3. Implement quality gates in merge checks

**By QALead** (ongoing):
1. Track coverage metrics weekly
2. Approve test design and standards
3. Coordinate with teams on blockers
4. Update release gate criteria as coverage improves

---

## Appendix: Test Environment Details

- **OS**: Linux 6.8.0-111-generic
- **Node.js**: v22.22.2
- **npm**: 10.x
- **Test Framework**: Jest 29.0.0
- **Assertion Library**: Jest built-in
- **API Testing**: Supertest (in dependencies, not yet used)
- **Backend Framework**: Express 4.18.2
- **Database**: SQLite (better-sqlite3)
- **Frontend**: React 18.3.1 + Vite 5.2.12

---

**Report Generated**: 2026-06-05  
**Status**: BASELINE AUDIT COMPLETE  
**Next Review**: When coverage reaches 50% (milestone)
