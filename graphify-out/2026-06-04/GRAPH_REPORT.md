# Graph Report - /var/www/digital-signage-app  (2026-06-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 318 nodes · 443 edges · 20 communities (18 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `compilerOptions` - 12 edges
3. `useToast()` - 10 edges
4. `Deployment Guide — Digital Signage` - 8 edges
5. `Playlist` - 7 edges
6. `playlistApi` - 6 edges
7. `screenApi` - 6 edges
8. `setTokens()` - 6 edges
9. `refresh()` - 6 edges
10. `compilerOptions` - 6 edges

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

## Communities (20 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (33): authApi, itemApi, mediaApi, playlistApi, scheduleApi, screenApi, userApi, MediaFileSchema (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (30): dataDir, db, DB_PATH, existingAdmin, itemsInfo, itemsInfo2, mediaInfo, mediaInfo2 (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (25): authHeaders(), request(), ErrorBoundary, Props, State, formatCountdown(), PairingScreen(), AppLayout() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, qrcode.react, react, react-dom, react-router-dom (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (24): description, devDependencies, jest, ts-jest, ts-node-dev, @types/bcryptjs, @types/better-sqlite3, @types/cors (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (22): 1. Clone the repository, 2. Configure environment, 3. Start the stack, 4. Verify, Auto-launch Chromium after login (X11 / LXDE), Auto-start on Boot, Data Persistence, Database errors on startup (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (15): BluetoothNavigator, DiscoveredDevice, useBluetooth(), UseBluetoothReturn, Home(), MediaLibrary(), PlaylistEditor(), Screens() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (9): ALLOWED_MIME_TYPES, MAGIC_BYTES, parseFps(), router, storage, THUMBNAILS_DIR, upload, UPLOADS_DIR (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (11): DAY_BITS, minuteInRange(), router, schedulesOverlap(), timeToMinutes(), formatScreen(), isOnline(), pairNewLimiter (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, lib, module, moduleResolution, outDir, resolveJsonModule, rootDir (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (14): dependencies, bcryptjs, better-sqlite3, cors, express, express-rate-limit, ffmpeg-static, @ffprobe-installer/ffprobe (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

## Knowledge Gaps
- **167 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 11` to `Community 4`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09219858156028368 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06923076923076923 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08108108108108109 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._