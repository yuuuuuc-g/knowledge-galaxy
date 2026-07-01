# Exocortex & Cognitive Refinery Project Guidelines

## 🛠 Project Stack
- **Framework**: Next.js (App Router)
- **3D Engine**: @react-three/fiber + @react-three/drei (Three.js)
- **AI Core**: Vercel AI SDK (`streamText` only, standard markdown generation)
- **Database**: Supabase (PostgreSQL)
- **Editor & UI**: TipTap (Edit Mode), `react-markdown` (Read Mode), Tailwind CSS + Typography (`prose-invert`)
- **Animations**: Framer Motion 3D / Framer Motion
- **Type Safety**: Strict TypeScript (Matt Pocock Style)

## 🏛 Architecture Patterns
- **Canvas-First (3D)**: `page.tsx` should only contain the `<Canvas>` and HUD containers. Celestial bodies (Star, Planet, Belt) are strictly split into `src/components/canvas/`.
- **Z-Index Strategy**: 
  - `Z-Index 0`: Three.js Canvas
  - `Z-Index 10`: HUD Overlays & Modals (e.g., Earth Portal UI)
- **Cognitive Funnel (Refinery)**: State-machine driven workflow (`Phase A` -> `B` -> `C` -> `D`).
- **Parser Robustness**: Strictly parse AI streaming text using Markdown list items (`- ` or `* `) via `split('\n')`. Do NOT use fragile Regex block matching.
- **Read/Edit Decoupling**: Phase D must separate rendering into two distinct states:
  - Read Mode: `<ReactMarkdown>` for beautiful, uneditable typography.
  - Edit Mode: `TipTap` for immersive text modification.

## 🗄️ Database Standards (Supabase)
- **Primary Keys**: Always use `uuid` (generated via `uuid_generate_v4()` in Supabase), never `int8`.
- **Client Initialization**: Centralized in `src/lib/supabase.ts` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 🧩 TypeScript Standards (Matt Pocock Style)
- **Ref Typing**: Explicit Three.js types for refs (e.g., `useRef<THREE.Group>(null!)`).
- **Props Interfaces**: Use `interface` for component props; exhaustive typing over `any`.
- **Zero-Assertion**: Avoid `as any`. Use type guards.
- **Utility Types**: Leverage `ComponentPropsWithoutRef`.

## 🌌 Performance Strategy (8GB RAM Device Optimization)
- **3D Instancing**: Use `Instances` or `Merged` for repetitive objects (asteroids, starfields).
- **Asset Management**: Always use `useGLTF.preload` for 3D models.
- **Frame Looping**: Use `useFrame` sparingly. Dispose of geometries/materials on unmount.
- **State Cleanup**: Always clear `useCompletion` text states (`setCompletion("")`) when transitioning between Refinery phases to prevent memory leaks and UI ghosting.

## 🤖 Agent Workflow (Orchestration & Engineering Skills)
You MUST read and adhere to the skills installed in the `.agents` directory before executing code changes. This project strictly follows the **Matt Pocock "Real Engineering" SOP**:

1. **Initial Setup (Mandatory)**
   - Run `/setup-matt-pocock-skills` (if not already done) to scaffold per-repo config for issue tracking, vocabulary, and domain docs.

2. **Planning & Alignment (Before Coding)**
   - Do NOT start writing code immediately.
   - Use **`/grill-with-docs`**: When tackling a complex task (e.g., Supabase integration or 3D interactions), interrogate the user to challenge the plan against the existing domain model. Update `CONTEXT.md` and ADRs inline.
   - Use **`/to-prd`**: After grilling, synthesize the conversation into a PRD to solidify the architecture.

3. **Implementation Strategy**
   - Use **`/prototype`**: For unproven integrations (e.g., testing Supabase writes or novel 3D HUD toggles), build a throwaway prototype first to resolve state/logic uncertainties before merging into the main codebase.
   - Use **`/tdd`**: When writing utility functions or core data transformations, adopt a red-green-refactor loop. Build vertical slices.

4. **Debugging & Refactoring**
   - Use **`/diagnose`**: If encountering React rendering loops or 3D canvas crashes, follow the strict diagnosis loop: reproduce → minimise → hypothesise → instrument → fix → regression-test.
   - Use **`/improve-codebase-architecture`**: Periodically analyze the component tree (e.g., `page.tsx` and `Earth.tsx`) to find deepening opportunities, guided by the domain language in `CONTEXT.md`.
   - Use **`/zoom-out`**: If stuck on localized state management, zoom out to analyze the broader architecture (e.g., how the Refinery state interacts with the Supabase client).

5. **Communication**
   - Use **`/caveman`**: To reduce token usage and drop filler, communicate with the user in ultra-compressed mode while retaining full technical accuracy.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with one root `CONTEXT.md` and root ADRs. See `docs/agents/domain.md`.
