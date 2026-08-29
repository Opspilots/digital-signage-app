# Digital Signage - Team Execution Package

**Prepared by**: QALead  
**For**: QualityEngineer, PlatformEngineer, Engineering Team  
**Purpose**: Ensure successful execution of 4-week QA initiative  
**Timeline**: Weeks 1-4 (2026-06-10 through 2026-07-03)

---

## Part 1: Test Case Template & Examples

### 1.1 Unit Test Template

**File**: `src/__tests__/example.test.ts`

```typescript
import { functionToTest } from '../utils/functionToTest';

describe('functionToTest', () => {
  describe('happy path', () => {
    it('should return expected value for valid input', () => {
      const result = functionToTest('valid-input');
      expect(result).toBe('expected-output');
    });

    it('should handle multiple valid inputs', () => {
      expect(functionToTest('input1')).toBe('output1');
      expect(functionToTest('input2')).toBe('output2');
    });
  });

  describe('error handling', () => {
    it('should return null for empty input', () => {
      const result = functionToTest('');
      expect(result).toBeNull();
    });

    it('should return null for invalid input', () => {
      const result = functionToTest('invalid');
      expect(result).toBeNull();
    });

    it('should handle special characters safely', () => {
      const result = functionToTest('<script>alert("XSS")</script>');
      expect(result).toBeNull(); // Or safely encoded
    });
  });

  describe('edge cases', () => {
    it('should handle maximum length input', () => {
      const longInput = 'x'.repeat(10000);
      expect(() => functionToTest(longInput)).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const result = functionToTest('你好世界');
      expect(result).toBeDefined();
    });
  });
});
```

### 1.2 API Integration Test Template

**File**: `src/__tests__/api-endpoints.test.ts`

```typescript
import request from 'supertest';
import app from '../index';
import { Database } from 'better-sqlite3';

describe('POST /api/playlists', () => {
  let db: Database;
  let token: string;

  beforeAll(() => {
    // Setup: Create test user and get auth token
    db = new Database(':memory:');
    // ... seed database
    // ... login and get token
  });

  afterEach(() => {
    // Cleanup: Delete test data
    db.exec('DELETE FROM playlists WHERE name LIKE "test-%"');
  });

  describe('create playlist', () => {
    it('should create playlist with valid input', async () => {
      const response = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'test-playlist',
          description: 'Test description',
          loop: true
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('test-playlist');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '',
          description: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/playlists')
        .send({
          name: 'test',
          description: 'Test'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('authorization checks', () => {
    it('should reject non-admin user creating playlist', async () => {
      // Get token for regular user (not admin)
      const userToken = await getUserToken('regular-user');

      const response = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'test',
          description: 'Test'
        });

      expect(response.status).toBe(403); // Forbidden
    });
  });
});
```

### 1.3 E2E Test Template

**File**: `frontend/tests/admin-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Playlist Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('http://localhost/');
    
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard');
  });

  test('should create and play playlist', async ({ page }) => {
    // Navigate to playlists
    await page.click('a:has-text("Playlists")');
    await expect(page).toHaveURL('**/playlists');

    // Create new playlist
    await page.click('button:has-text("Add Playlist")');
    await page.fill('input[name="name"]', 'E2E Test Playlist');
    await page.fill('textarea[name="description"]', 'Test description');
    await page.click('button:has-text("Create")');

    // Verify creation
    await expect(page.locator('text=E2E Test Playlist')).toBeVisible();

    // Upload media
    await page.click('button:has-text("Add Media")');
    await page.setInputFiles('input[type="file"]', 'test-video.mp4');
    await page.waitForURL('**/upload-complete');

    // Add to playlist
    await page.click('button:has-text("Add to Playlist")');
    await expect(page.locator('text=Media added')).toBeVisible();

    // Start playback
    await page.click('button:has-text("Play")');
    
    // Verify player loaded
    await expect(page.locator('video')).toBeVisible();
  });

  test('should handle upload error gracefully', async ({ page }) => {
    await page.click('a:has-text("Media")');
    await page.click('button:has-text("Upload")');

    // Try to upload invalid file
    await page.setInputFiles('input[type="file"]', 'invalid.txt');
    await page.click('button:has-text("Upload")');

    // Verify error message
    await expect(page.locator('text=Invalid file format')).toBeVisible();
  });
});
```

---

## Part 2: Weekly Status Report Template

**For QALead to use every Friday**

```markdown
# QA Metrics - Week [N] Report

## Summary
- Coverage: [%] (target: 70%, delta: [+/-]%)
- Tests Added: [N] new tests
- Tests Passing: [N]/[TOTAL] ([%]%)
- Issues Fixed: [N] (P0: [N], P1: [N], P2: [N])

## Coverage Trend
- Week 0: 36.59% (baseline)
- Week [N]: [%] (current)
- Projected Week 4: 70% (on track: YES/NO)

## Tests Written This Week
- [ ] Auth endpoints: [X]/8 tests
- [ ] Playlist CRUD: [X]/20 tests
- [ ] Screen management: [X]/10 tests
- [ ] Media operations: [X]/15 tests

## Blockers
- [List any blockers]
- Action: [Who is fixing, ETA]

## Next Week Plan
- [Test work planned]
- [Bug fixes planned]
- [CI/CD updates]

## Metrics
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Coverage | 70% | [%] | ⏳ |
| Tests Pass | 100% | [%] | ✓/❌ |
| P0 Bugs | 0 | [N] | ✓/❌ |

---
```

---

## Part 3: Implementation Readiness Checklist

### For QualityEngineer

**Before Starting Task #2 (Week 1)**:

- [ ] Read QA_FINDINGS_REPORT.md (understand coverage gaps)
- [ ] Read BUG_REPORTS.md (understand bug specs)
- [ ] Understand test templates (above)
- [ ] Have test database setup locally
- [ ] Run existing tests: `npm test` (verify baseline 36.59%)
- [ ] Setup code editor with Jest extensions
- [ ] Create test file for first API endpoint
- [ ] Test local development workflow

**Definition of Done for Each API Test**:

- [ ] Test written in proper format (see template)
- [ ] Test passes locally
- [ ] Test validates both happy path and error cases
- [ ] Code review completed
- [ ] Merged to main branch
- [ ] Test shows in coverage report

### For PlatformEngineer

**Before Starting Task #4 (Week 1)**:

- [ ] Read CI_CD_IMPLEMENTATION_SPEC.md (complete)
- [ ] Understand GitHub Actions / GitLab CI
- [ ] Have access to secrets management
- [ ] Verify Docker registry setup (if using)
- [ ] Create `.github/workflows/ci-cd.yml` (or `.gitlab-ci.yml`)
- [ ] Test workflow locally with act (GitHub) or dry-run (GitLab)
- [ ] Configure branch protection rules
- [ ] Setup codecov.io account (or similar)
- [ ] Test full pipeline on sample PR

**Definition of Done for CI/CD**:

- [ ] All tests run on every PR
- [ ] Coverage report generated
- [ ] PR comments showing results
- [ ] Branch protection blocking non-passing PRs
- [ ] Merge only allowed with passing checks
- [ ] Team trained on reading reports

### For Engineering Team

**Before Week 1 Starts**:

- [ ] Understand QA initiative goals (70% coverage by Week 4)
- [ ] Review BUG_REPORTS.md (understand P0 and P2 issues)
- [ ] Fix P0 bug: Default admin password (IMMEDIATE)
- [ ] Fix P2 bug: parseFps (Week 1)
- [ ] Understand code review will require test updates
- [ ] Be prepared to write unit tests alongside features

---

## Part 4: Risk Register & Mitigation

### Risk 1: Coverage Plateau at 50%

**Trigger**: Week 2 shows <50% coverage  
**Impact**: Won't reach 70% by Week 4  
**Probability**: Medium  

**Mitigation**:
- Weekly check-ins with QualityEngineer
- Prioritize high-impact tests (auth, playlist)
- Pair programming if tests are complex
- Escalate to CTO for resource increase

### Risk 2: CI/CD Setup Delays

**Trigger**: GitHub Actions not configured by end of Week 1  
**Impact**: Tests not automated, quality gates not enforced  
**Probability**: Low  

**Mitigation**:
- Start immediately (Week 1)
- Use provided spec (complete YAML ready)
- Test pipeline early on sample PR
- Have backup: manual test runs if CI fails

### Risk 3: Unexpected P0 Bug Found

**Trigger**: Production bug found during testing  
**Impact**: Delays coverage work, must fix immediately  
**Probability**: Low  

**Mitigation**:
- Pull QualityEngineer to fix (priority)
- Document as P0 in BUG_REPORTS.md
- Escalate to CTO
- Resume coverage work once fixed

### Risk 4: FFmpeg/Media Processing Issues

**Trigger**: FFmpeg tests fail, media tests blocked  
**Impact**: Incomplete media endpoint coverage  
**Probability**: Medium  

**Mitigation**:
- Coordinate with engineering on FFmpeg expertise
- May need to mock FFmpeg for some tests
- Document media testing limitations
- Escalate if blocking coverage goal

### Risk 5: E2E Test Flakiness

**Trigger**: Playwright tests fail intermittently (race conditions)  
**Impact**: Unreliable test results, reduced confidence  
**Probability**: Medium  

**Mitigation**:
- Use proper waits (waitForSelector, waitForNavigation)
- Avoid hardcoded timeouts
- Test on multiple browsers (Chrome, Firefox)
- Use test retries sparingly (investigate failures first)

---

## Part 5: Communication Plan

### Weekly Status (Every Friday)

**To**: CTO  
**Format**: Email + Slack  
**Content**: See "Weekly Status Report Template" (Part 2)  
**Time**: 30 minutes

**Key Points**:
- Coverage trend
- Blockers
- Next week plan
- Any red flags

### Blockers (Immediate)

**To**: CTO  
**Trigger**: Cannot proceed on critical path item  
**Response Time**: Same day  
**Examples**:
- P0 bug blocks test writing
- CI/CD infrastructure not available
- Required tools missing

### Weekly Team Sync (Monday 10am)

**Attendees**: QALead, QualityEngineer, PlatformEngineer, Engineering Lead  
**Duration**: 30 minutes  
**Topics**:
- Prior week review (metrics, blockers)
- Current week plan (tests, CI/CD, fixes)
- Dependencies and risks
- Next blockers anticipated

### Code Review Expectations

**Standards**:
- All test PRs require review
- 1+ approval required before merge
- Tests must have good coverage of feature
- No bare assertions (explain what's being tested)

**Turnaround**: 24 hours (same business day preferred)

---

## Part 6: Success Criteria & Validation

### Week 1 Success
- [ ] 15+ API tests written
- [ ] Coverage at 40%+
- [ ] CI/CD pipeline running on every PR
- [ ] Branch protection enforced
- [ ] P0 and P2 bugs fixed
- [ ] No blockers for Week 2

### Week 2 Success
- [ ] 30+ API tests written
- [ ] Coverage at 50%+
- [ ] All test results in PR comments
- [ ] Coverage report visible
- [ ] Frontend E2E tests planned
- [ ] No blockers for Week 3

### Week 3 Success
- [ ] 50+ API tests written
- [ ] Frontend E2E tests running
- [ ] Coverage at 60%+
- [ ] Performance baseline measured
- [ ] No regressions observed
- [ ] On track for Week 4 target

### Week 4 Success (TARGET)
- [ ] 70%+ coverage achieved ✓
- [ ] All quality gates passing
- [ ] E2E tests complete
- [ ] Production deployment ready
- [ ] Documentation updated
- [ ] Team confident in release

---

## Part 7: Tools & Environment Setup

### Required Tools

**For QualityEngineer**:
```bash
# Install dependencies
cd backend
npm ci

# Verify test execution
npm test

# Watch mode (optional, for development)
npm test -- --watch

# Generate coverage
npm test -- --coverage
```

**For PlatformEngineer**:
```bash
# Test GitHub Actions locally
npm install -g act
act -l  # List jobs

# Or test GitLab CI dry-run
gitlab-runner exec docker job_name
```

### Environment Variables

**For Tests**:
```
NODE_ENV=test
DB_PATH=:memory:  (use in-memory SQLite for tests)
JWT_SECRET=test-secret-key-for-testing
ADMIN_PASSWORD=test-password
```

### Local Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/auth-tests

# 2. Write tests
vim src/__tests__/auth.test.ts

# 3. Run tests locally
npm test

# 4. Commit and push
git add src/__tests__/auth.test.ts
git commit -m "feat: add auth endpoint tests (8 tests, +4.2% coverage)"
git push origin feature/auth-tests

# 5. Create PR
# GitHub/GitLab auto-runs tests
# Wait for CI results
# Get code review

# 6. Merge when approved
# CI runs again on main
```

---

## Part 8: Escalation & Decision Tree

### When to Escalate to CTO

**Situation**: Cannot reach 70% by Week 4

**Decision Tree**:
1. Is it a resource issue? (More hours needed)
   → Request additional QualityEngineer hours
2. Is it a technical blocker? (Tool, infrastructure)
   → Unblock immediately (PlatformEngineer)
3. Is it a design issue? (Tests impossible to write)
   → Revise coverage targets or implementation

**Escalation Template**:
```
ESCALATION: [Title]
Impact: 70% coverage goal at risk
Blocker: [What is blocking]
Requested Action: [What needs to happen]
Timeline: [When decision needed]
```

### Code Review Disagreements

**If QualityEngineer disagrees with review feedback**:

1. Discuss in comment thread
2. If unresolved, loop in Engineering Lead
3. Engineering Lead makes final call
4. Document decision

### Test Failure Investigation

**If a test fails unexpectedly**:

1. Run locally: `npm test -- --testNamePattern="test name"`
2. Check for flakiness: Run 5 times
3. If intermittent: Debug race condition
4. If consistent: Fix test or code, commit fix
5. If blocker: Escalate to Engineering Lead

---

## Part 9: Metrics Collection Process

### Every Friday (QALead)

**1. Run coverage (10 min)**
```bash
cd backend
npm test -- --coverage --watchAll=false
```

**2. Extract metrics (5 min)**
```
Statements: [%]
Branches: [%]
Functions: [%]
Lines: [%]
```

**3. Compare to baseline (5 min)**
```
Week 0: 36.59%
Week [N]: [%]
Trend: [+/- points]
Forecast Week 4: [%]
```

**4. Count tests (5 min)**
- Total tests: [N]
- Passing: [N] ([%])
- Failing: [N]

**5. Document findings (5 min)**
- Update QA_METRICS_TRACKING.md
- Send weekly report to CTO

**Total Time**: ~30 minutes per week

---

## Part 10: Training & Handoff

### Knowledge Transfer (Week of 2026-06-10)

**For QualityEngineer**:
- [ ] Review all QA documents
- [ ] Understand test templates
- [ ] Setup local test environment
- [ ] Run existing tests
- [ ] Ask questions (1-hour pairing)
- [ ] Write first test independently

**For PlatformEngineer**:
- [ ] Review CI/CD spec
- [ ] Understand workflow structure
- [ ] Setup test environment
- [ ] Create sample workflow
- [ ] Test on PR
- [ ] Debug any issues

**For Engineering Team**:
- [ ] Understand QA gates
- [ ] Know where to find specs
- [ ] Understand test requirements
- [ ] Review bug reports

### Documentation Links

**Quick Start**:
- [QA_EXECUTIVE_SUMMARY.md](QA_EXECUTIVE_SUMMARY.md) - Overview for leadership
- [BUG_REPORTS.md](BUG_REPORTS.md) - Issues to fix
- [Test Template](#) - How to write tests

**Deep Dive**:
- [QA_FINDINGS_REPORT.md](QA_FINDINGS_REPORT.md) - Detailed findings
- [CI_CD_IMPLEMENTATION_SPEC.md](CI_CD_IMPLEMENTATION_SPEC.md) - How to setup CI/CD
- [SECURITY_ACCESSIBILITY_AUDIT_SPEC.md](SECURITY_ACCESSIBILITY_AUDIT_SPEC.md) - Future audits

---

## Conclusion

This execution package provides teams with:
- ✓ Clear templates to follow
- ✓ Weekly process to track
- ✓ Risk awareness and mitigation
- ✓ Escalation paths
- ✓ Success criteria
- ✓ Communication plan
- ✓ Tool setup guidance
- ✓ Training materials

**Ready for team handoff and Week 1 execution.**

---

**Prepared by**: QALead (e4603e5b-33bd-41a4-a24b-061db4fa8b48)  
**Date**: 2026-06-05  
**Status**: Ready for distribution to teams
