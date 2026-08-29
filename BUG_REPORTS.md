# Digital Signage - Bug Reports & Specifications

**Report Date**: 2026-06-05  
**QA Owner**: QALead  
**Status**: Ready for Engineering Assignment

---

## BUG #1: parseFps Utility - Empty String Handling

### Summary
The `parseFps()` utility function returns `0` for empty string input instead of returning `null`, indicating an invalid or missing FPS value.

### Severity
**P2 (Medium)** - Edge case bug, potential impact on video processing

### Component
- **File**: `src/utils/parseFps.ts`
- **Function**: `parseFps(fps: string): number | null`
- **Test**: `src/utils/parseFps.test.ts` (Line 17)

### Current Behavior
```typescript
parseFps('') // Returns: 0
parseFps('30') // Returns: 30 (correct)
parseFps('invalid') // Returns: NaN (needs validation)
```

### Expected Behavior
```typescript
parseFps('') // Should return: null (invalid input indicator)
parseFps('30') // Should return: 30 (correct)
parseFps('invalid') // Should return: null (error case)
```

### Root Cause
The function does not validate for empty string before attempting to parse. Empty string converts to `0` in numeric context.

```typescript
// Current implementation (INCORRECT):
export function parseFps(fps: string): number | null {
  const parsed = parseFloat(fps);
  if (isNaN(parsed)) return null;
  return parsed;
}

// Empty string '' → parseFloat('') → 0 (incorrect!)
```

### Impact Analysis

**High-Risk Areas**:
1. **Media Processing**: FPS value used in FFmpeg command construction
   - 0 FPS results in invalid FFmpeg arguments
   - Could cause transcoding to fail silently
   
2. **Playlist Duration**: Frame rate affects duration calculations
   - 0 FPS could cause playlist timing issues
   - Video might display incorrect duration in UI

3. **Video Validation**: Used to validate uploaded media files
   - Allows invalid files to pass validation
   - Could cause runtime errors during playback

### Test Case (Currently Failing)
```typescript
it('returns null for empty string', () => {
  expect(parseFps('')).toBeNull(); // FAILS: actual value is 0
});
```

### Fix Specification

**Recommended Solution** (1-line fix):
```typescript
export function parseFps(fps: string): number | null {
  if (!fps || fps.trim() === '') return null; // ADD THIS LINE
  const parsed = parseFloat(fps);
  if (isNaN(parsed)) return null;
  return parsed;
}
```

**Alternative Solution** (More defensive):
```typescript
export function parseFps(fps: string): number | null {
  if (!fps || typeof fps !== 'string' || fps.trim() === '') {
    return null;
  }
  const parsed = parseFloat(fps);
  return isNaN(parsed) ? null : parsed;
}
```

### Test Coverage After Fix
```typescript
it('returns null for empty string', () => {
  expect(parseFps('')).toBeNull(); // ✓ PASS
});

it('returns null for whitespace-only string', () => {
  expect(parseFps('   ')).toBeNull(); // ✓ PASS
});

it('returns parsed number for valid input', () => {
  expect(parseFps('30')).toBe(30); // ✓ PASS
  expect(parseFps('29.97')).toBe(29.97); // ✓ PASS
});

it('returns null for non-numeric input', () => {
  expect(parseFps('invalid')).toBeNull(); // ✓ PASS
});
```

### Implementation Steps

1. **Implement fix** (5 minutes)
   - Add empty string check at function start
   - Run existing tests: `npm test -- src/utils/parseFps.test.ts`
   
2. **Verify all tests pass** (2 minutes)
   - All 5 test cases should pass
   - No regressions in other utilities
   
3. **Code review** (10 minutes)
   - Review the 1-line change
   - Verify test coverage
   - Approve and merge

4. **Run full test suite** (3 minutes)
   - `npm test`
   - Verify: 10/10 tests passing

**Estimated Total Time**: 20 minutes

### Review Criteria
- [ ] Empty string returns `null`
- [ ] All 5 parseFps tests passing
- [ ] No regressions in other test suites
- [ ] Code review approved
- [ ] Merged to main branch

---

## ISSUE #2: Security - Default Admin Credentials

### Summary
The backend uses a default admin password (`'admin'`) for initial login, which must be changed before production deployment.

### Severity
**P0 (CRITICAL)** - Security vulnerability, blocks production deployment

### Component
- **Configuration**: Backend `.env` file
- **Variable**: `ADMIN_PASSWORD`
- **Detection**: Console warning on startup

### Current State
```
Backend startup logs show:
[SECURITY WARNING] ADMIN_PASSWORD is set to the default value "admin". 
Set a strong password in .env before production use.
```

### Risk Assessment

**Threat Model**:
- Default password is well-known
- Allows unauthorized admin access
- No rate limiting on login attempts (verify in Task #7)
- Access to all admin functions (create/delete playlists, manage screens)

**Attack Surface**:
1. Admin login endpoint: `/api/auth/login`
2. Default credentials: `username: admin`, `password: admin`
3. No account lockout observed (needs verification)
4. No MFA implemented

### Business Impact
- Unauthorized playlist modification
- Screen configuration changes (displays wrong content)
- Media deletion (data loss)
- System downtime
- Compliance violations (if deployed in regulated environment)

### Fix Specification

**Step 1: Generate Strong Password**
```bash
openssl rand -hex 16
# Example output: 8f3a5c2b9d1e4f7a6c3b8e2d5f9a1c4d
```

**Step 2: Update Backend Configuration**
```bash
# Edit backend/.env
ADMIN_PASSWORD=<strong-password-from-step-1>

# Example:
ADMIN_PASSWORD=8f3a5c2b9d1e4f7a6c3b8e2d5f9a1c4d
```

**Step 3: Verify Fix**
```bash
# Restart backend
systemctl restart digital-signage.service

# Check logs - warning should be gone
journalctl -u digital-signage.service | grep "SECURITY WARNING"
# Expected: (no output = warning gone ✓)
```

**Step 4: Document Password**
- Store securely in organization's password manager
- Only admin users have access
- Never commit to git
- Include in deployment runbook

### Validation Checklist
- [ ] Password generated using `openssl rand` (32+ characters)
- [ ] `.env` updated with new password
- [ ] Password stored securely in password manager
- [ ] Backend restarted
- [ ] Security warning absent from logs
- [ ] Login works with new credentials
- [ ] Old credentials (`admin`/`admin`) don't work
- [ ] Documented in deployment procedures

### Timeline
**IMMEDIATE** - Must be done before any production deployment

### Deployment Blockers
🔴 **DO NOT DEPLOY** until this is fixed

---

## ISSUE #3: Configuration - Missing Environment Variables

### Summary
Several environment variables should be documented and validated to prevent deployment issues.

### Severity
**P2 (Medium)** - Could cause deployment problems, should be addressed

### Component
- **File**: Backend `.env` configuration
- **Related**: `src/db/schema.ts` (where warnings are logged)

### Required Variables (Verify in .env)

| Variable | Current Value | Required | Notes |
|----------|---------------|----------|-------|
| `PORT` | 3001 | Yes | Backend listening port |
| `CORS_ORIGIN` | * (allow all) | Yes | Should restrict to frontend domain |
| `JWT_SECRET` | ✓ Set | Yes | Token signing secret (strong) |
| `ADMIN_PASSWORD` | ❌ 'admin' | Yes | **CRITICAL - see Issue #2** |
| `ADMIN_USERNAME` | 'admin' | Yes | Default admin account name |
| `DB_PATH` | './data/signage.db' | Yes | SQLite database location |

### Configuration Issues

**Issue 3.1: CORS Too Permissive**
- Current: `CORS_ORIGIN=*` (allow all origins)
- Risk: Anyone can call the API from any website
- Fix: Set to specific frontend domain in production

**Issue 3.2: Database Path Not Validated**
- Current: Assumes `./data/` directory exists
- Risk: If directory doesn't exist, database fails to create
- Fix: Create `data/` directory on startup or validate in code

### Recommendations
1. Add `.env.production` example template
2. Validate all required vars on startup
3. Fail loudly if critical vars missing
4. Document each variable in DEVELOPMENT.md

---

## Bug Fix Workflow

### For Engineering Team

**Priority 1 (Week 1)**:
- [ ] **BUG #1**: parseFps fix (20 minutes)
  - File: `src/utils/parseFps.ts`
  - Test: Run `npm test -- parseFps`
  - Owner: Any engineer

**Priority 0 (IMMEDIATE)**:
- [ ] **ISSUE #2**: Change default admin password (5 minutes)
  - File: `backend/.env`
  - Owner: DevOps/Engineer
  - Verify: No "SECURITY WARNING" on startup

**Priority 2 (Sprint Planning)**:
- [ ] **ISSUE #3**: Add config validation (1-2 hours)
  - File: `src/index.ts` (startup code)
  - Owner: Backend engineer

### Review & Approval

**Code Review Checklist**:
- [ ] Fix addresses root cause (not just symptom)
- [ ] Tests updated or added
- [ ] No regressions in test suite
- [ ] Performance impact: none
- [ ] Security impact: positive
- [ ] Documentation updated

**QA Sign-Off**:
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] Performance metrics stable
- [ ] Ready for next release

---

## Appendix: Test Results Reference

### Current Failing Test

**File**: `src/utils/parseFps.test.ts`  
**Line**: 17  
**Test Name**: `returns null for empty string`

```typescript
it('returns null for empty string', () => {
  expect(parseFps('')).toBeNull(); // FAILS
  // Expected: null
  // Received: 0
});
```

**Current Test Run Output**:
```
FAIL src/utils/parseFps.test.ts
  ● parseFps › returns null for empty string
    expect(received).toBeNull()
    Received: 0
    
    at Object.<anonymous> (src/utils/parseFps.test.ts:17:26)
```

---

**End of Bug Reports**  
**Status**: Ready for Engineering Assignment  
**Total Estimated Fix Time**: ~30 minutes (all bugs)
