# Digital Signage - CI/CD Implementation Specification

**Created by**: QALead  
**For**: PlatformEngineer (Task #4)  
**Timeline**: Weeks 1-2  
**Effort**: 20-30 hours  

---

## Executive Summary

This specification defines the CI/CD pipeline requirements for Digital Signage. The pipeline must:
1. Run automated tests on every PR (Jest backend + Playwright frontend)
2. Enforce quality gates (≥70% coverage, all tests passing)
3. Generate coverage reports and artifacts
4. Build and push Docker images on release
5. Complete in <10 minutes per PR

---

## Part 1: Pipeline Architecture

### 1.1 Technology Choices

**Recommended**: GitHub Actions (if using GitHub) or GitLab CI (if using GitLab)

**Rationale**:
- No additional infrastructure (cloud-based)
- Native integration with repository
- Generous free tier for open source
- YAML-based configuration (version-controlled)

**Alternative Options**:
- Jenkins (self-hosted, complex setup)
- CircleCI (cloud, paid tier needed for private repos)
- Travis CI (legacy, less commonly used)

---

### 1.2 Pipeline Stages

```
Trigger (PR/Push) 
  ↓
[Stage 1] Setup & Install (1 min)
  ├─ Node version: 22.22.2
  ├─ npm install --ci (use lockfile)
  └─ Cache node_modules
  ↓
[Stage 2] Lint & Format (1 min)
  ├─ TypeScript type check (npx tsc --noEmit)
  └─ ESLint (if configured)
  ↓
[Stage 3] Unit Tests (2 min)
  ├─ Backend: npm test (Jest)
  ├─ Generate coverage report
  └─ Enforce ≥70% coverage threshold
  ↓
[Stage 4] Build (2 min)
  ├─ Frontend: npm run build (Vite)
  ├─ Backend: npm run build (TypeScript)
  └─ Verify build artifacts created
  ↓
[Stage 5] E2E Tests (3 min) - *Future phase*
  ├─ Start backend service
  ├─ Run Playwright tests
  └─ Capture screenshots on failure
  ↓
[Stage 6] Docker Build (2 min) - *On release*
  ├─ Build Docker images
  ├─ Push to Docker Hub / ECR
  └─ Tag with version
  ↓
[Stage 7] Report & Artifacts (Async)
  ├─ Post coverage report to PR
  ├─ Post test results to PR
  └─ Archive coverage reports

Total Pipeline Time: ~11 minutes (with caching)
```

---

## Part 2: GitHub Actions Implementation

### 2.1 Workflow File Structure

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  setup-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.22.2]
    steps:
      # ... steps defined below
```

### 2.2 Detailed Workflow Steps

**File**: `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    steps:
      # ===== Stage 1: Setup =====
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for git diff
      
      - uses: actions/setup-node@v3
        with:
          node-version: '22.22.2'
          cache: 'npm'
          cache-dependency-path: 'backend/package-lock.json'
      
      - name: Install dependencies (backend)
        run: |
          cd backend
          npm ci --legacy-peer-deps  # Use lockfile, fail on mismatch
      
      # ===== Stage 2: Lint & Type Check =====
      - name: TypeScript type check
        run: |
          cd backend
          npx tsc --noEmit
      
      # ===== Stage 3: Unit Tests =====
      - name: Run unit tests with coverage
        run: |
          cd backend
          npm test -- --coverage --watchAll=false
      
      - name: Upload coverage report
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend
          fail_on_error: true
      
      - name: Enforce coverage threshold
        run: |
          cd backend
          COVERAGE=$(grep -oP '% Stmts\s+\K[0-9.]+' coverage/coverage-summary.json | head -1)
          THRESHOLD=70
          if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
            echo "❌ Coverage $COVERAGE% is below threshold $THRESHOLD%"
            exit 1
          fi
          echo "✓ Coverage $COVERAGE% meets threshold"
      
      # ===== Stage 4: Build =====
      - name: Build backend
        run: |
          cd backend
          npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: backend-build
          path: backend/dist/
          retention-days: 7
      
      # ===== Stage 5: Docker Build (on release) =====
      - name: Build Docker image
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          cd backend
          docker build -t digital-signage-backend:latest .
          docker tag digital-signage-backend:latest digital-signage-backend:${{ github.ref_name }}
      
      # ===== Stage 6: Publish Reports =====
      - name: Comment PR with test results
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('backend/coverage/coverage-summary.json'));
            const comment = `
            ## Test Results
            - ✓ Backend Tests Passed
            - Coverage: ${coverage.total.lines.pct}%
            - Status: ${{ job.status }}
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '22.22.2'
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'
      
      - name: Install dependencies (frontend)
        run: |
          cd frontend
          npm ci
      
      - name: Type check
        run: |
          cd frontend
          npx tsc --noEmit
      
      - name: Build frontend
        run: |
          cd frontend
          npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: frontend-build
          path: frontend/dist/
          retention-days: 7

  quality-gates:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    if: always()
    
    steps:
      - name: Check quality gates
        run: |
          if [ "${{ needs.backend-tests.result }}" != "success" ]; then
            echo "❌ Backend tests failed"
            exit 1
          fi
          if [ "${{ needs.frontend-tests.result }}" != "success" ]; then
            echo "❌ Frontend tests failed"
            exit 1
          fi
          echo "✓ All quality gates passed"
      
      - name: Require PR approval
        if: github.event_name == 'pull_request'
        run: |
          echo "✓ PR requires review approval before merge"
```

---

## Part 3: GitLab CI Implementation

**File**: `.gitlab-ci.yml`

```yaml
image: node:22.22.2

stages:
  - test
  - build
  - deploy

variables:
  NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.npm"
  NODE_ENV: "test"

cache:
  paths:
    - .npm/
    - backend/node_modules/
    - frontend/node_modules/

backend-test:
  stage: test
  script:
    - cd backend
    - npm ci --cache .npm
    - npx tsc --noEmit
    - npm test -- --coverage --watchAll=false
  coverage: '/% Stmts\s+(\d+\.\d+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: backend/coverage/cobertura-coverage.xml
    paths:
      - backend/coverage/
    expire_in: 30 days
  allow_failure: false

frontend-test:
  stage: test
  script:
    - cd frontend
    - npm ci --cache .npm
    - npx tsc --noEmit
    - npm run build
  artifacts:
    paths:
      - frontend/dist/
    expire_in: 7 days
  allow_failure: false

quality-gate:
  stage: test
  script:
    - echo "✓ Quality gates verification"
    - |
      if [ ! -f backend/coverage/coverage-summary.json ]; then
        echo "❌ Coverage report not found"
        exit 1
      fi
      COVERAGE=$(grep -oP '% Stmts\s+\K[0-9.]+' backend/coverage/coverage-summary.json | head -1)
      THRESHOLD=70
      if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
        echo "❌ Coverage $COVERAGE% below threshold $THRESHOLD%"
        exit 1
      fi
  dependencies:
    - backend-test
  allow_failure: false

docker-build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t digital-signage-backend:latest backend/
    - docker tag digital-signage-backend:latest $REGISTRY_PATH/digital-signage-backend:$CI_COMMIT_SHORT_SHA
  only:
    - tags
  allow_failure: false
```

---

## Part 4: Quality Gate Enforcement

### 4.1 Merge Protection Rules

**GitHub**:
1. Settings → Branches → Branch protection rules
2. Create rule for `main` branch:
   - ✓ Require status checks to pass before merging
   - ✓ Require branches to be up to date before merging
   - ✓ Require code review before merging (1+ approval)
   - ✓ Dismiss stale PR approvals when new commits are pushed
   - ✓ Require signed commits
   - ✓ Include administrators in restrictions

**GitLab**:
1. Settings → Repository → Protected branches
2. Protect `main` branch:
   - Allow merge: Maintainers
   - Allow push: No one
   - Require code review: Yes (≥1)
   - Require all discussions resolved: Yes

### 4.2 Required Status Checks

```
Status checks required to pass:
✓ backend-test (npm test passes)
✓ coverage-gate (≥70% coverage)
✓ frontend-build (npm run build succeeds)
✓ type-check (TypeScript compilation succeeds)
```

---

## Part 5: Artifact Management

### 5.1 Coverage Reports

**Storage**: GitHub Artifacts or GitLab CI artifacts

**Retention**:
- Coverage reports: 30 days
- Build artifacts: 7 days
- Test results: 30 days

**Access**:
- Download from GitHub Actions/GitLab CI UI
- Integrate with codecov.io for visualization
- Post to PR comments

### 5.2 Docker Images

**Registry**: Docker Hub, Amazon ECR, or GitHub Container Registry

**Tagging Strategy**:
```
Latest: digital-signage-backend:latest
Release: digital-signage-backend:v1.0.0
Commit: digital-signage-backend:abc1234
```

**Push on**:
- Release tags (v*.*.*)
- Main branch (optional, for deployment)

---

## Part 6: Implementation Checklist

### Week 1: GitHub Actions Setup

- [ ] Create `.github/workflows/ci-cd.yml`
- [ ] Configure Node version (22.22.2)
- [ ] Setup npm caching
- [ ] Implement backend test job
- [ ] Implement coverage enforcement
- [ ] Implement frontend build job
- [ ] Test on sample PR
- [ ] Verify artifacts generated

### Week 1-2: Branch Protection

- [ ] Enable branch protection for `main`
- [ ] Require status checks
- [ ] Require code review (1+ approval)
- [ ] Require signed commits
- [ ] Test protection (attempt force merge)

### Week 2: Reporting & Notifications

- [ ] Setup codecov.io integration
- [ ] Post coverage to PR comments
- [ ] Configure Slack notifications (optional)
- [ ] Email notifications for failures

### Week 2: Docker & Deployment

- [ ] Configure Docker registry credentials
- [ ] Add Docker build step for releases
- [ ] Test image build locally
- [ ] Verify image runs correctly

---

## Part 7: Security Considerations

### 7.1 Secrets Management

**Store securely** (never in code):
- Docker registry credentials
- npm registry tokens
- Deployment SSH keys
- API keys for external services

**GitHub Secrets**:
Settings → Secrets and variables → Actions
```
DOCKER_REGISTRY_URL
DOCKER_REGISTRY_USERNAME
DOCKER_REGISTRY_PASSWORD
NPM_TOKEN (if needed)
DEPLOY_KEY (for production)
```

**GitLab CI/CD Variables**:
Settings → CI/CD → Variables
- Check "Protected" for production secrets
- Check "Masked" to hide in logs

### 7.2 Access Control

- [ ] Only maintainers can approve merges
- [ ] Only CI can push Docker images
- [ ] Deploy keys read-only except for CI
- [ ] GitHub/GitLab tokens with minimal scope

---

## Part 8: Monitoring & Maintenance

### 8.1 Metrics to Track

**Per Week**:
- Test execution time (target: <10 min)
- Coverage trend (target: >70%)
- Build success rate (target: >95%)
- PR merge rate
- Failed checks trend

**Dashboard**:
- GitHub Actions: Insights tab
- GitLab CI: Analytics → CI/CD

### 8.2 Maintenance Tasks

**Monthly**:
- [ ] Review and update Node version
- [ ] Update npm packages (security)
- [ ] Review failed builds for patterns
- [ ] Adjust timeouts if needed

**Quarterly**:
- [ ] Review runner utilization
- [ ] Update branch protection rules
- [ ] Audit secrets (rotate if needed)
- [ ] Plan for scale (more runners if needed)

---

## Part 9: Rollback & Failure Handling

### 9.1 If Pipeline Fails

**Test Failure**:
1. Check test results in GitHub Actions UI
2. Download coverage/test artifacts
3. Fix code locally
4. Push new commit to PR

**Coverage Below Threshold**:
1. Review coverage report
2. Add tests to bring coverage above 70%
3. Push new commit

**Build Failure**:
1. Check build logs
2. Fix TypeScript errors or build issues
3. Test locally: `npm run build`

### 9.2 Disabling Checks (Emergency Only)

**Temporary Disable** (if critical):
1. Branch protection → Dismiss stale reviews
2. Re-enable after fix is merged

**Never**:
- Commit without running tests locally
- Merge with failing checks
- Disable protection permanently

---

## Part 10: Deployment Integration

### 10.1 Push to Production

**Trigger**: On release tag (v*.*.*)

**Steps**:
1. Build Docker image
2. Push to registry
3. Deploy to staging (optional)
4. Create release notes
5. Notify deployment team

**Example**:
```bash
git tag v1.0.0
git push origin v1.0.0
# CI automatically builds and pushes image
docker pull digital-signage-backend:v1.0.0
docker run -e ADMIN_PASSWORD=<strong> ...
```

---

## Part 11: Cost Estimation

### GitHub Actions
- **Free tier**: 2,000 minutes/month
- **Project needs**: ~30 min/day × 20 working days = 600 min/month
- **Status**: ✓ Within free tier

### GitLab CI
- **Free tier**: 400 minutes/month
- **Project needs**: 600 minutes/month needed
- **Cost**: Need paid tier (~$99/month for 2,000 min)

### Docker Registry
- **Docker Hub**: Free (1 private repo)
- **Amazon ECR**: Pay-per-image-stored (~$0.01 per GB)
- **GitHub Container Registry**: Free

---

## Part 12: Success Criteria

**Pipeline is Ready When**:

- [ ] All tests pass on first commit
- [ ] Coverage report generates correctly
- [ ] PR comments show test results
- [ ] Branch protection enforces checks
- [ ] Artifacts stored and retrievable
- [ ] <10 minute execution time achieved
- [ ] No manual steps required
- [ ] Team trained on CI/CD flow

---

## Part 13: Documentation for Team

**What PlatformEngineer needs to deliver**:

1. ✓ CI/CD pipeline configured and working
2. ✓ Branch protection enabled on main
3. ✓ Coverage reports integrated
4. ✓ Docker image building (if using Docker)
5. ✓ Team documentation (how to read reports, troubleshoot)
6. ✓ Runbook for common failures

**What QALead will verify**:
- All quality gates enforced
- Coverage reports accurate
- Merge protection working
- Notifications alerting team

---

## Timeline & Acceptance

**Week 1**:
- GitHub Actions/GitLab CI configured
- Tests running on PR
- Coverage reporting working

**Week 2**:
- Branch protection enabled
- Docker builds (if applicable)
- Full testing on sample PR
- **Ready for QALead acceptance**

**Acceptance Criteria**:
- [ ] All test jobs passing consistently
- [ ] Coverage > 70% enforced
- [ ] PR comments showing results
- [ ] No manual intervention needed
- [ ] Documentation complete
- [ ] Team trained

---

**Ready for PlatformEngineer Implementation** (Week 1)
