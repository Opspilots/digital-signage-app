# Digital Signage - Security & Accessibility Audit Specification

**Created by**: QALead  
**For**: QualityEngineer (Task #7)  
**Timeline**: Weeks 8-12 (after coverage baseline achieved)  
**Effort**: 10-15 hours  

---

## Part 1: Security Audit Specification

### 1.1 OWASP Top 10 Testing Checklist

#### A1: Injection (SQL, Command, NoSQL)

**Threat Model**:
- SQLite injection in playlist/media queries
- Command injection in FFmpeg parameters
- Log injection attacks

**Test Cases**:

```sql
-- SQL Injection Tests
POST /api/playlists
{
  "name": "test' OR '1'='1",
  "description": "bypass"
}
Expected: Input sanitized, injection blocked

POST /api/media
{
  "filename": "video'; DROP TABLE playlists; --"
}
Expected: Filename escaped, injection blocked

-- Command Injection Tests (FFmpeg)
POST /api/media
{
  "filename": "video.mp4 | rm -rf /",
  "title": "; whoami"
}
Expected: Command characters escaped
```

**Verification**:
- [ ] SQLite query uses parameterized statements
- [ ] FFmpeg arguments properly quoted/escaped
- [ ] Input validation on file paths
- [ ] No command execution from user input

**OWASP Severity**: Critical  
**Fix if found**: P0 - Immediate fix required

---

#### A2: Broken Authentication & Session Management

**Threat Model**:
- Weak password requirements
- Session token vulnerabilities
- Missing logout functionality
- Token reuse/replay attacks

**Test Cases**:

```javascript
// Weak password acceptance test
POST /api/auth/login
{
  "username": "admin",
  "password": "a"  // Single character
}
Expected: Rejected (min 8 chars recommended)

// Session token test
GET /api/playlists
Headers: Authorization: Bearer <valid-token>
Response: 200 OK, data returned

// After logout
GET /api/playlists
Headers: Authorization: Bearer <same-token>
Expected: 401 Unauthorized (token invalidated)

// Token expiration test
1. Login, get token
2. Wait 1 hour
3. Use same token
Expected: 401 Unauthorized (token expired)

// Token tampering test
GET /api/playlists
Headers: Authorization: Bearer <token-with-1-char-changed>
Expected: 401 Unauthorized (signature invalid)
```

**Verification**:
- [ ] Password minimum length enforced (8+ chars)
- [ ] Password complexity checked (upper, lower, number, special)
- [ ] Token expiration implemented
- [ ] Token signature validation working
- [ ] Logout invalidates token
- [ ] Account lockout after N failed attempts

**OWASP Severity**: Critical  
**Fix if found**: P0 - Security critical

---

#### A3: Cross-Site Scripting (XSS)

**Threat Model**:
- Stored XSS in playlist names, descriptions, media titles
- Reflected XSS in search/filter parameters
- DOM-based XSS in frontend

**Test Cases**:

```javascript
// Stored XSS - Playlist name
POST /api/playlists
{
  "name": "<img src=x onerror=alert('XSS')>",
  "description": "test"
}
GET /api/playlists
Expected: HTML entities encoded in response
// Frontend should display: &lt;img src=x ...&gt; (not execute)

// Stored XSS - Media title
POST /api/media
{
  "title": "<script>alert('XSS')</script>"
}
GET /api/media
Expected: Script tags encoded, not executed

// Reflected XSS - Query parameter
GET /api/playlists?search=<script>alert('XSS')</script>
Expected: Parameter escaped in response

// DOM XSS - Frontend form
Fill form with: <img src=x onerror="fetch('attacker.com')">
Expected: Not executed, safely displayed
```

**Verification**:
- [ ] All user input HTML-encoded in responses
- [ ] Content-Type headers set to text/plain or application/json
- [ ] X-Content-Type-Options: nosniff header set
- [ ] Frontend uses textContent not innerHTML for user input
- [ ] CSP (Content-Security-Policy) header configured

**OWASP Severity**: High  
**Fix if found**: P1 - High priority fix

---

#### A4: Insecure Direct Object References (IDOR)

**Threat Model**:
- Access other users' playlists by changing ID
- Access other users' screens
- Bypass ownership checks

**Test Cases**:

```javascript
// Access other user's playlist
User A login → Get token → Access /api/playlists/uuid-user-b
Expected: 403 Forbidden (access denied)

// Delete other user's playlist
User A → DELETE /api/playlists/uuid-user-b
Expected: 403 Forbidden

// Modify other user's screen
User A → PATCH /api/screens/uuid-user-b
Expected: 403 Forbidden

// Sequence attack
1. Create playlist A (own)
2. Note the UUID pattern
3. Try sequential UUIDs
Expected: Can only access own UUIDs
```

**Verification**:
- [ ] All resource access checks ownership
- [ ] ACL (Access Control List) enforced
- [ ] Cannot access resources by guessing UUIDs
- [ ] Admin-only endpoints properly protected

**OWASP Severity**: High  
**Fix if found**: P1 - Access control bypass

---

#### A5: Cross-Site Request Forgery (CSRF)

**Threat Model**:
- Attacker tricks user into modifying playlists
- Session hijacking through CSRF

**Test Cases**:

```html
<!-- CSRF Test - Playlist deletion -->
<img src="https://app.local:3001/api/playlists/uuid?_method=DELETE" />
<!-- If user is logged in, attempt delete -->
Expected: 403 Forbidden (CSRF token required)

<!-- CSRF with form submission -->
<form action="https://app.local:3001/api/playlists" method="POST">
  <input name="name" value="hacked">
  <input name="csrf_token" value="">
</form>
Expected: Token validation fails
```

**Verification**:
- [ ] CSRF tokens required on all state-changing requests (POST, PUT, DELETE)
- [ ] Tokens validated server-side
- [ ] SameSite cookies configured
- [ ] Origin/Referer header validation

**OWASP Severity**: Medium  
**Fix if found**: P2 - CSRF protection needed

---

#### A6: Insecure Cryptographic Storage

**Threat Model**:
- Passwords stored in plaintext
- Sensitive data in database unencrypted
- Keys exposed in code

**Test Cases**:

```javascript
// Password storage test
1. Login with user
2. Access database: sqlite3 data/signage.db
3. SELECT password FROM users;
Expected: Hashed password (bcrypt), NOT plaintext

// JWT Secret test
Check code and .env for exposed secrets
Expected: JWT_SECRET NOT in version control

// Session token storage
Check if tokens stored plain in database
Expected: Tokens hashed or encrypted, not plaintext
```

**Verification**:
- [ ] Passwords hashed with bcrypt (not MD5 or plain)
- [ ] JWT secret strong (32+ random chars)
- [ ] JWT secret not in git repository
- [ ] Sensitive data encrypted at rest (optional for small app)
- [ ] No hardcoded secrets in code

**OWASP Severity**: High  
**Fix if found**: P1 - Crypto vulnerability

---

#### A7: Broken Access Control

**Threat Model**:
- Public endpoints accessible without authentication
- Admin functions not checking permissions

**Test Cases**:

```javascript
// Unauthenticated access test
GET /api/playlists
No Authorization header
Expected: 401 Unauthorized

GET /api/screens
Expected: 401 Unauthorized

GET /health
Expected: 200 OK (health check is public)

// Admin endpoint test - Non-admin user
User (regular) → POST /api/users (create user)
Expected: 403 Forbidden

// Permission test
User A → PATCH /api/screens/uuid-user-b/config
Expected: 403 Forbidden (not owner)
```

**Verification**:
- [ ] All sensitive endpoints require authentication
- [ ] Admin endpoints check admin role
- [ ] User can only modify own resources
- [ ] Public endpoints clearly documented
- [ ] No privilege escalation possible

**OWASP Severity**: Critical  
**Fix if found**: P0 - Access control issue

---

#### A8: Using Components with Known Vulnerabilities

**Threat Model**:
- Outdated dependencies with CVEs
- Unpatched security bugs

**Test Cases**:

```bash
# Dependency audit
npm audit
Expected: No critical/high vulnerabilities

# Check dependency versions
npm list express
Expected: Latest stable version (no known CVEs)

# Test vulnerable FFmpeg
# (Test with known vulnerable version if available)
Expected: FFmpeg properly validates input
```

**Verification**:
- [ ] Run `npm audit` - no critical issues
- [ ] Dependencies up-to-date (npm update)
- [ ] Security patches applied
- [ ] No deprecated packages used
- [ ] SBOM (Software Bill of Materials) generated

**OWASP Severity**: High  
**Fix if found**: P1 - Update dependencies immediately

---

#### A9: Insufficient Logging & Monitoring

**Threat Model**:
- No audit trail of admin actions
- Security events not logged
- Attacks undetected

**Test Cases**:

```javascript
// Login audit test
1. Failed login attempt (wrong password)
2. Check logs for entry
Expected: Failed attempt logged with timestamp, user

3. Successful login
Expected: Logged (for audit trail)

4. Playlist deletion by admin
Expected: Logged (who deleted what, when)

// Error logging test
Trigger 500 error
Expected: Error logged (not exposed to user)
```

**Verification**:
- [ ] Failed login attempts logged
- [ ] Admin actions logged (CRUD operations)
- [ ] Errors logged (without exposing internals to user)
- [ ] Logs include timestamp, user, action
- [ ] No sensitive data in logs (passwords, tokens)

**OWASP Severity**: Medium  
**Fix if found**: P2 - Add logging

---

#### A10: Insufficient Rate Limiting

**Threat Model**:
- Brute force login attacks
- DoS through API flooding
- Spam uploads

**Test Cases**:

```bash
# Brute force test
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong'$i'"}'
done
Expected: After 5-10 attempts, 429 Too Many Requests

# Rate limit per endpoint
Send 100 GET /api/playlists requests rapidly
Expected: Requests rate-limited after threshold

# Rate limit reset
Hit limit, wait 15 minutes
Expected: Requests accepted again
```

**Verification**:
- [ ] Rate limiting enabled on /api/auth/login (5 attempts/15min)
- [ ] Rate limiting on file uploads (prevent DoS)
- [ ] Rate limiting per IP address (not global)
- [ ] 429 response when limit exceeded
- [ ] Limits reset after timeout

**OWASP Severity**: Medium  
**Fix if found**: P2 - Implement rate limiting

---

### 1.2 Additional Security Checks

#### A. File Upload Security

**Test Cases**:

```javascript
// Malicious file upload test
POST /api/media
File: "virus.exe" masquerading as ".mp4"
Expected: Mime-type validation, extension check, no execution

// Large file DoS
POST /api/media
File: 10GB file
Expected: Rejected (size limit enforced), no OOM

// Zip bomb / Archive bomb
POST /api/media
File: Compressed archive (high ratio)
Expected: Extracted size validated, not allowed if too large

// Path traversal
POST /api/media
Filename: "../../../etc/passwd"
Expected: Path sanitized, file saved safely
```

**Verification**:
- [ ] File type validated (whitelist, not blacklist)
- [ ] File size limited (max 5GB recommended)
- [ ] Filenames sanitized (no path traversal)
- [ ] Files scanned by antivirus (if available)
- [ ] Uploaded files not executable (served as download)

---

#### B. Network Security

**Test Cases**:

```javascript
// HTTPS enforcement
GET http://app.local:3001/api/playlists
Expected: Redirect to HTTPS or blocked

// HTTPS certificate validation
curl https://app.local:3001 (with self-signed cert)
Expected: Certificate error (in production, use valid cert)

// Security headers test
curl -I https://app.local:3001/api/health
Expected: Headers present:
  - X-Frame-Options: DENY (clickjacking protection)
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security: max-age=31536000
  - Content-Security-Policy: ...
```

**Verification**:
- [ ] HTTPS enforced (no plain HTTP in production)
- [ ] Valid certificate (not self-signed in production)
- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] No open ports except 80, 443, 3001

---

#### C. API Security

**Test Cases**:

```javascript
// API versioning
GET /api/v1/playlists vs /api/v2/playlists
Expected: Endpoints versioned, old versions supported/deprecated

// API documentation
GET /api/docs
Expected: API docs available, no secrets exposed

// API key rotation
Expected: Ability to rotate JWT secrets without downtime

// API rate limiting per user
Expected: Different limits for anonymous vs authenticated
```

**Verification**:
- [ ] API versioned (supports backward compatibility)
- [ ] API documentation available
- [ ] No secrets in API docs
- [ ] Rate limiting per user/IP
- [ ] Request validation (schema, content-type)

---

## Part 2: Accessibility Audit Specification

### 2.1 WCAG 2.1 AA Compliance Checklist

#### A. Keyboard Navigation

**Test Cases**:

```javascript
// Tab navigation
1. Page load
2. Press Tab repeatedly
3. Focus should move through all interactive elements
Expected: Tab order logical, all buttons/links reachable

// Tab index order
Elements with tabindex should follow logical order
Expected: tabindex values in ascending order (or not used)

// Keyboard shortcuts
Alt+O for OK button
Expected: Works and announced to screen readers

// No keyboard traps
Tab through all elements
Expected: Can escape any element (no focus trapped)

// Enter key activation
Focus on button, press Enter
Expected: Button activates (not just on click)

// Space key for checkboxes
Focus on checkbox, press Space
Expected: Checkbox toggles
```

**Verification**:
- [ ] All interactive elements reachable via keyboard
- [ ] Tab order is logical and visible
- [ ] No keyboard traps
- [ ] Focus indicators visible (not hidden)
- [ ] All buttons activate with Enter key
- [ ] Checkboxes toggle with Space

---

#### B. Screen Reader Support

**Test Cases** (using NVDA or JAWS):

```javascript
// Page title announced
Open page, screen reader should announce page title
Expected: Title clearly identifies page purpose

// Heading hierarchy
Page structure:
<h1>Admin Dashboard</h1>
<h2>Playlists</h2>
<h3>Playlist Controls</h3>
Expected: Headings in correct order (no skipping levels)

// Form labels
<label for="playlist-name">Playlist Name:</label>
<input id="playlist-name" type="text">
Expected: Label associated with input, announced together

// Button text meaningful
<button>OK</button> vs <button>Save Playlist</button>
Expected: Button text describes action (not "Click here")

// Image alt text
<img src="icon.png" alt="Delete playlist icon">
Expected: Alt text describes image purpose

// ARIA attributes
<div role="alert">Error: Invalid input</div>
Expected: Screen reader announces as alert
```

**Verification**:
- [ ] Page has descriptive title
- [ ] Headings use correct hierarchy (h1, h2, h3...)
- [ ] Form inputs have associated labels
- [ ] Button text describes action
- [ ] Images have descriptive alt text
- [ ] ARIA attributes used correctly
- [ ] Error messages announced to screen readers
- [ ] Link text meaningful (not "click here")

---

#### C. Color & Contrast

**Test Cases** (using WebAIM, WAVE, or Lighthouse):

```javascript
// Color contrast ratio test
Foreground: #FFFFFF on Background: #000000
Expected: Ratio 21:1 (exceeds 4.5:1 minimum)

// Disabled state
Button disabled: gray text on light gray
Expected: Contrast still ≥ 4.5:1

// Focus indicator
Button outline when focused
Expected: Visible, ≥ 3px, high contrast

// Color-only communication
"Red indicates error, green is success"
Expected: Also uses icon/text, not color alone

// Text size test
Smallest text: 12px
Expected: Still readable (14px+ recommended)
```

**Verification**:
- [ ] Color contrast ≥ 4.5:1 for normal text
- [ ] Color contrast ≥ 3:1 for large text (18pt+)
- [ ] Information not conveyed by color alone
- [ ] Focus indicators visible (≥ 3px, high contrast)
- [ ] Text size minimum 12px (14px recommended)
- [ ] No text as image (use HTML text)

---

#### D. Responsive Design

**Test Cases**:

```javascript
// Mobile viewport
<meta name="viewport" content="width=device-width, initial-scale=1">
Expected: Present and configured

// Responsive layout
Test on: 320px, 768px, 1200px widths
Expected: Layout adapts without horizontal scroll

// Touch targets
Buttons minimum 44x44 px (recommend 48x48)
Expected: Easy to tap on mobile

// Zoom support
Zoom in to 200%
Expected: Page still functional, no content hidden

// Mobile form
Form inputs on mobile
Expected: Appropriate keyboard (number for phone input)
```

**Verification**:
- [ ] Viewport meta tag configured
- [ ] Layout responsive (no horizontal scroll)
- [ ] Touch targets ≥ 44px
- [ ] Zoom functional (up to 200%)
- [ ] Input types correct (email, tel, number)
- [ ] No layout shift (CLS < 0.1)

---

### 2.2 Accessibility Test Tools

**Automated Testing**:
```bash
# Lighthouse (Chrome DevTools)
Expected: Accessibility score ≥ 90

# WAVE Browser Extension
Expected: No errors, minimal warnings

# axe DevTools
Expected: No critical issues

# pa11y (CLI)
npm install -g pa11y
pa11y https://app.local
Expected: Pass grade or minor warnings only
```

---

## Part 3: Test Execution Plan

### Week 8: Security Testing
- [ ] Run OWASP Top 10 tests (4 hrs)
- [ ] Test file upload security (2 hrs)
- [ ] Network security headers (1 hr)
- [ ] API security review (1 hr)
- [ ] Document findings (1 hr)

### Week 9: Accessibility Testing
- [ ] Keyboard navigation audit (2 hrs)
- [ ] Screen reader testing (2 hrs)
- [ ] Color/contrast audit (1 hr)
- [ ] Responsive design testing (1 hr)
- [ ] Run automated tools (1 hr)

### Week 10: Issues & Reporting
- [ ] Triage findings (1 hr)
- [ ] Create issue reports (2 hrs)
- [ ] Severity assessment (1 hr)
- [ ] Final report (1 hr)

**Total**: 10-15 hours

---

## Part 4: Severity Classification

### Security Issues

| Severity | Criteria | Examples |
|----------|----------|----------|
| **P0 Critical** | Remote execution, auth bypass, data loss | SQL injection, RCE, default creds |
| **P1 High** | Access control, significant data exposure | IDOR, XSS, weak crypto |
| **P2 Medium** | Limited impact, requires user interaction | CSRF, rate limiting missing |
| **P3 Low** | Informational, best practices | Logging gaps, headers missing |

### Accessibility Issues

| Severity | Criteria | Examples |
|----------|----------|----------|
| **Blocker** | Prevents use entirely | No keyboard nav, unreadable text |
| **Major** | Significant barrier | Missing alt text, poor contrast |
| **Minor** | Inconvenient but workaround exists | Non-standard heading order |

---

## Part 5: Deliverables

**Upon Completion**:
1. Security Audit Report
   - OWASP Top 10 findings
   - Severity classification
   - Recommendations

2. Accessibility Audit Report
   - WCAG 2.1 AA compliance status
   - Issue list with fixes
   - Accessibility score

3. Issue Tracking
   - All findings in bug tracking system
   - Assigned to engineering team
   - Prioritized by severity

4. Remediation Plan
   - Timeline for fixes
   - Owner assignment
   - Verification criteria

---

**Ready for QualityEngineer Assignment** (Week 8)
