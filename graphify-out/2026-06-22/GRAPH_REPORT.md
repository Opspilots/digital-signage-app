# Graph Report - /var/www/digital-signage-app  (2026-06-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 709 nodes · 823 edges · 28 communities (26 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Client API Endpoints|Client API Endpoints]]
- [[_COMMUNITY_Database Schema Design|Database Schema Design]]
- [[_COMMUNITY_React Component Library|React Component Library]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Deployment Guide Digital Signage|Deployment Guide Digital Signage]]
- [[_COMMUNITY_TypeScript Compiler Options|TypeScript Compiler Options]]
- [[_COMMUNITY_Performance Optimization|Performance Optimization]]
- [[_COMMUNITY_Media File Processing|Media File Processing]]
- [[_COMMUNITY_Bug Fix parseFps Function|Bug Fix: parseFps Function]]
- [[_COMMUNITY_TypeScript Build Configuration|TypeScript Build Configuration]]
- [[_COMMUNITY_Team Execution Package|Team Execution Package]]
- [[_COMMUNITY_Node TypeScript Config|Node TypeScript Config]]
- [[_COMMUNITY_Backup Database Script|Backup Database Script]]
- [[_COMMUNITY_Deploy Script|Deploy Script]]
- [[_COMMUNITY_CICD Implementation Spec|CI/CD Implementation Spec]]
- [[_COMMUNITY_QA Initiative Completion|QA Initiative Completion]]
- [[_COMMUNITY_Bug Reports & Specifications|Bug Reports & Specifications]]
- [[_COMMUNITY_QA Executive Summary for CTO|QA Executive Summary for CTO]]
- [[_COMMUNITY_Manual Testing Checklist|Manual Testing Checklist]]
- [[_COMMUNITY_QA Findings Report|QA Findings Report]]
- [[_COMMUNITY_QA Metrics Tracking|QA Metrics Tracking]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Digital Signage - CI/CD Implementation Specification` - 16 edges
3. `Digital Signage - Performance Baseline & Analysis` - 14 edges
4. `QA Initiative - Executive Summary for CTO` - 14 edges
5. `Digital Signage - QA Metrics Tracking` - 14 edges
6. `BUG #1: parseFps Utility - Empty String Handling` - 13 edges
7. `Digital Signage - QA Findings Report` - 13 edges
8. `Digital Signage QA Initiative - Completion Summary` - 13 edges
9. `compilerOptions` - 12 edges
10. `Bug Fix: parseFps Function` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `MediaFile`  [EXTRACTED]
  frontend/src/pages/MediaLibrary.tsx → frontend/src/api/types.ts
- `Home()` --calls--> `useToast()`  [EXTRACTED]
  frontend/src/pages/Home.tsx → frontend/src/toast.tsx
- `MediaLibrary()` --calls--> `useToast()`  [EXTRACTED]
  frontend/src/pages/MediaLibrary.tsx → frontend/src/toast.tsx
- `PlaylistEditor()` --calls--> `useToast()`  [EXTRACTED]
  frontend/src/pages/PlaylistEditor.tsx → frontend/src/toast.tsx
- `RequireAuth()` --calls--> `isAuthenticated()`  [EXTRACTED]
  frontend/src/App.tsx → frontend/src/auth.ts

## Import Cycles
- None detected.

## Communities (28 total, 2 thin omitted)

### Community 0 - "Client API Endpoints"
Cohesion: 0.06
Nodes (52): authApi, authHeaders(), itemApi, mediaApi, playlistApi, scheduleApi, screenApi, userApi (+44 more)

### Community 1 - "Database Schema Design"
Cohesion: 0.05
Nodes (41): dataDir, db, DB_PATH, existingAdmin, itemsInfo, itemsInfo2, mediaInfo, mediaInfo2 (+33 more)

### Community 2 - "React Component Library"
Cohesion: 0.10
Nodes (21): request(), ErrorBoundary, Props, State, AppLayout(), icons, navItems, RequireAuth() (+13 more)

### Community 3 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, qrcode.react, react, react-dom, react-router-dom (+18 more)

### Community 4 - "Project Dependencies"
Cohesion: 0.05
Nodes (38): dependencies, bcryptjs, better-sqlite3, cors, express, express-rate-limit, ffmpeg-static, @ffprobe-installer/ffprobe (+30 more)

### Community 5 - "Deployment Guide Digital Signage"
Cohesion: 0.09
Nodes (22): 1. Clone the repository, 2. Configure environment, 3. Start the stack, 4. Verify, Auto-launch Chromium after login (X11 / LXDE), Auto-start on Boot, Data Persistence, Database errors on startup (+14 more)

### Community 6 - "TypeScript Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 7 - "Performance Optimization"
Cohesion: 0.04
Nodes (44): 10. Baseline Summary Table, 11. Optimization Opportunities (Non-Blocking), 1. Startup Performance, 2. Memory Footprint, 3. Test Execution Performance, 4. Code Quality Metrics, 5. API Performance (Estimated), 6. Hardware Performance Estimates (+36 more)

### Community 8 - "Media File Processing"
Cohesion: 0.12
Nodes (9): ALLOWED_MIME_TYPES, MAGIC_BYTES, parseFps(), router, storage, THUMBNAILS_DIR, upload, UPLOADS_DIR (+1 more)

### Community 9 - "Bug Fix: parseFps Function"
Cohesion: 0.11
Nodes (17): After Fix, Before Fix, Bug Fix: parseFps Function, Files Modified, Fix Applied, Fixed Behavior, Impact Analysis, Issue Fixed (+9 more)

### Community 10 - "TypeScript Build Configuration"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, lib, module, moduleResolution, outDir, resolveJsonModule, rootDir (+6 more)

### Community 11 - "Team Execution Package"
Cohesion: 0.05
Nodes (40): 1.1 Unit Test Template, 1.2 API Integration Test Template, 1.3 E2E Test Template, Blockers (Immediate), Code Review Disagreements, Code Review Expectations, Conclusion, Digital Signage - Team Execution Package (+32 more)

### Community 12 - "Node TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 20 - "CI/CD Implementation Spec"
Cohesion: 0.05
Nodes (38): 10.1 Push to Production, 1.1 Technology Choices, 1.2 Pipeline Stages, 2.1 Workflow File Structure, 2.2 Detailed Workflow Steps, 4.1 Merge Protection Rules, 4.2 Required Status Checks, 5.1 Coverage Reports (+30 more)

### Community 21 - "QA Initiative Completion"
Cohesion: 0.05
Nodes (38): 📈 4-Week Coverage Forecast, 📞 Approval & Next Steps, 📊 Baseline Metrics Achieved, 🎉 Conclusion, Core QA Documents (8), 📋 Deliverables Checklist, Digital Signage QA Initiative - Completion Summary, 📚 Documentation Index (+30 more)

### Community 22 - "Bug Reports & Specifications"
Cohesion: 0.05
Nodes (37): Appendix: Test Results Reference, BUG #1: parseFps Utility - Empty String Handling, Bug Fix Workflow, Business Impact, Component, Component, Component, Configuration Issues (+29 more)

### Community 23 - "QA Executive Summary for CTO"
Cohesion: 0.06
Nodes (34): 1. CTO Review & Approve ✋ (TODAY), 2. Assign PlatformEngineer (This Week), 3. Assign QualityEngineer (This Week), 4. Engineering Lead Coordination (This Week), 5. Launch Tracking (Week 1), Contact & Questions, Cost of Action (Recommended), Cost of Inaction (Risk) (+26 more)

### Community 24 - "Manual Testing Checklist"
Cohesion: 0.06
Nodes (34): 1.1 Backend Service Startup & Health, 1.2 Frontend Service & Web UI, 1.3 API Response Validation, 2.1 Admin UI Navigation, 2.2 Create & Configure Playlist, 2.3 Register & Configure Screen, 3.1 Video File Support, 3.2 Large File Handling (+26 more)

### Community 25 - "QA Findings Report"
Cohesion: 0.06
Nodes (33): 10. Next Steps, 1.1 Overall Coverage Metrics, 1.2 Test Execution Results, 1.3 Coverage by Module, 1. Test Coverage Baseline, 2.1 BUG: parseFps Utility - Empty String Handling, 2. Bugs Found, 3.1 CRITICAL: Default Admin Credentials (+25 more)

### Community 26 - "QA Metrics Tracking"
Cohesion: 0.06
Nodes (33): 1. Collect Metrics (15 min), 2. Update Tracking Sheet (10 min), 3. Analyze Trends (15 min), 4. Report & Communicate (15 min), 5. Update Roadmap (10 min), API Endpoint Coverage Status, Application Performance Baseline, Bug Tracking (+25 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (32): 1.1 OWASP Top 10 Testing Checklist, 1.2 Additional Security Checks, 2.1 WCAG 2.1 AA Compliance Checklist, 2.2 Accessibility Test Tools, A10: Insufficient Rate Limiting, A1: Injection (SQL, Command, NoSQL), A2: Broken Authentication & Session Management, A3: Cross-Site Scripting (XSS) (+24 more)

## Knowledge Gaps
- **449 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+444 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `version`, `description` to the rest of the system?**
  _449 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Client API Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.0594679186228482 - nodes in this community are weakly interconnected._
- **Should `Database Schema Design` be split into smaller, more focused modules?**
  _Cohesion score 0.0512987012987013 - nodes in this community are weakly interconnected._
- **Should `React Component Library` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._
- **Should `Frontend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Deployment Guide Digital Signage` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._