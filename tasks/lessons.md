# Lessons Learned

Rules derived from mistakes in this project. Claude MUST review this file at the start of every session and follow these rules.

---

### 2026-03-27 — ShelfOrganizer import stripped 3 times by editor auto-fix

**What went wrong:** Added `import { ShelfOrganizer }` and the JSX usage in separate edits. Between edits, VS Code's "organize imports on save" (or eslint --fix) stripped the import as unused. Had to re-add it 3 times across 3 commits.

**Why it's wrong:** VS Code with `next/typescript` eslint config auto-removes unused imports on save. If the import is added before the JSX that uses it, there's a window where the import appears unused and gets stripped.

**Rule:** When adding a new component import + JSX usage, ALWAYS add both the import and the JSX in a SINGLE Edit tool call, or at minimum in the same file write. Never add an import in one edit and the usage in a separate edit. If that's not possible, add `// eslint-disable-next-line` on the import.

**Category:** anti-pattern

---

### 2026-03-27 — Supabase client initialized at module level fails Docker build

**What went wrong:** `/api/scan/[shortId]/route.ts` created `const supabase = createClient(...)` at the top level. During Docker build, `SUPABASE_SERVICE_ROLE_KEY` wasn't available as a build arg, causing the build to fail.

**Why it's wrong:** Next.js API routes are pre-rendered/analyzed at build time. Top-level code that reads env vars fails if those vars aren't present during `pnpm build`. `NEXT_PUBLIC_` vars are injected via Docker ARGs, but server-only vars weren't.

**Rule:** In Next.js API routes, ALWAYS create Supabase/DB clients INSIDE the handler function, never at module level. This ensures env vars are read at request time, not build time.

**Category:** mistake

---

### 2026-03-27 — `depth_row: "full"` bins vanished from shelf organizer

**What went wrong:** The shelf organizer only checked for `depthRow === "front"` or `depthRow === "back"`. Bins with `depth_row: "full"` (spanning the entire shelf depth) were filtered out and invisible.

**Why it's wrong:** TypeScript type was `"front" | "back"` but the actual DB data included `"full"`. The cast silently passed but the filter logic excluded them.

**Rule:** When filtering by an enum-like field from the DB, ALWAYS handle ALL possible values, including any that might exist in the data but not in the TypeScript type. Check the actual DB values with a query before assuming.

**Category:** mistake

---

### 2026-03-27 — CSS Grid can't stack items in the same cell

**What went wrong:** Used CSS Grid with `gridColumn` to position bins on a shelf. Bins at the same position should stack vertically, but CSS Grid places items sequentially — it can't overlap items in the same cell without explicit grid-row assignment.

**Why it's wrong:** Two bins at `colStart: 0` in the same grid both try to occupy the same grid area. CSS Grid flows them into separate rows or forces them side-by-side, breaking the visual layout.

**Rule:** For layouts where items must OVERLAP or STACK in the same position, use absolute positioning within a relative container, not CSS Grid. Group overlapping items into flex columns at the correct absolute position.

**Category:** mistake

---

### 2026-03-27 — NEXT_PUBLIC env vars not available in Docker build

**What went wrong:** First deploy to Coolify failed with client-side error because `NEXT_PUBLIC_SUPABASE_URL` wasn't baked into the JS during Docker build. These vars must be present at `pnpm build` time, not just at runtime.

**Why it's wrong:** Next.js inlines `NEXT_PUBLIC_*` variables into the client JS bundle at build time. If they're not in the environment during `pnpm build`, the client code gets `undefined`.

**Rule:** For Dockerized Next.js apps, ALL `NEXT_PUBLIC_*` vars MUST be passed as Docker build ARGs in the Dockerfile and in the CI workflow. Runtime env vars don't work for client-side code.

**Category:** mistake

---

### 2026-03-27 — Expo/React Native was wrong approach for iPhone app

**What went wrong:** Built an Expo React Native app. Hit: Metro bundler complexity, hundreds of Xcode warnings, CocoaPods dependency hell, provisioning profile failures, App Transport Security blocks. Abandoned for SwiftUI.

**Why it's wrong:** PLY (the reference project) used native SwiftUI successfully. Should have followed the proven pattern instead of introducing React Native, which added a massive dependency layer with no benefit for a simple app.

**Rule:** When building an iOS app for this user, ALWAYS use native SwiftUI following the PLY pattern (`/ios/PeopleLikeYou/`). Never use React Native/Expo. Check existing iOS projects for the established pattern before choosing a framework.

**Category:** mistake

---

### 2026-03-27 — Auth race condition: pages loaded before householdId was ready

**What went wrong:** Storage pages called `store.getLocations()` before `AuthProvider` finished loading, causing queries with empty `household_id` → 400 errors and infinite loading spinners.

**Why it's wrong:** In Supabase mode, `useStore()` binds `householdId` from `useAuth()`. If the page's `useEffect` fires before auth completes, `householdId` is empty string, and all RLS-protected queries fail silently.

**Rule:** Every page that fetches data in Supabase mode MUST guard with `if (authLoading) return` in its useEffect, and include `[authLoading, householdId]` in the dependency array.

**Category:** mistake

---

### 2026-03-27 — (Positive) Server-side API route for colocated DB queries

**What went well:** Created `/api/storage` to bundle all data fetching server-side. The Next.js server on Hetzner queries Supabase locally (sub-ms) instead of the browser making 3+ round trips to Germany (~500ms total). Single pattern, reusable.

**Rule:** For Hetzner-deployed apps with Supabase, prefer server-side API routes for read-heavy pages. The browser makes 1 request to the app server; the server makes fast local queries to Supabase.

**Category:** positive-pattern
