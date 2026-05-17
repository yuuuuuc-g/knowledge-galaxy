## Problem Statement

The Knowledge Galaxy project currently operates entirely in-memory. The Analytical Pipeline (A→B→C→D workflow) loses all user progress on page refresh, and there is no way to browse previously generated documents. Users need persistent storage for their cognitive work products, with clear separation between the generic document archive and module-specific process metadata.

## Solution

Integrate Supabase as the persistent backend, implementing a two-tier schema: a generic `documents` table serves as the central archive for all final outputs, while module-specific tables (starting with `analytical_sessions`) preserve process metadata for reconstructing how each document was produced. The 3D solar system becomes the navigation layer: clicking Mars enters the Analytical Pipeline for new sessions, while clicking Earth opens the Archive panel to browse all persisted documents.

## User Stories

1. As a user, I want my generated documents to persist after I close the browser, so that I can return to my work later.
2. As a user, I want to browse all my previously created documents in one place, so that I can find and reference past analysis.
3. As a user, I want to see how a specific document was produced, so that I can understand the reasoning chain behind it.
4. As a user, I want to start a new analytical session by clicking on Mars in the 3D view, so that the interface feels immersive and spatial.
5. As a user, I want to access my document archive by clicking on Earth, so that I can quickly review my knowledge base without leaving the galaxy view.
6. As a user, I want my documents to be private and isolated from other users, so that my intellectual work remains secure.
7. As a developer, I want a centralized Supabase client initialization, so that auth and database access are consistent across the codebase.
8. As a developer, I want TypeScript types generated from the database schema, so that I get compile-time safety for all database operations.
9. As a developer, I want Row Level Security policies enforced at the database level, so that data access control is tamper-proof.
10. As a user, I want the Archive panel to show document metadata (title, creation date, source module), so that I can quickly scan my collection.
11. As a user, I want to close the Archive panel and return to the 3D galaxy view, so that the spatial navigation remains my primary interaction model.
12. As a developer, I want the schema to support future modules (Knowledge Graph, RAG Library) without structural changes, so that the system is extensible.
13. As a user, I want the Analytical Pipeline to automatically save its final output to the Archive when I complete Phase D, so that I don't need to manually export my work.
14. As a developer, I want the 3D interaction layer to be decoupled from routing logic, so that Planet components remain pure presentation.

## Implementation Decisions

- **Schema Pattern**: Central `documents` table + module-specific process tables (`analytical_sessions`). The `documents` table uses a `source_module` check constraint (`archive`, `analytical-pipeline`, `knowledge-graph`) to track origin without fragmenting the query surface.
- **Primary Keys**: All tables use `uuid` with `uuid_generate_v4()` default, per AGENTS.md standards.
- **User Isolation**: Both tables include `user_id uuid references auth.users(id) not null` to support per-user data isolation via RLS.
- **Phase Storage**: `analytical_sessions.phases` uses a single `jsonb` column with structure `{ a: {...}, b: {...}, c: {...} }` rather than separate columns. This avoids schema churn if the phase model evolves.
- **Client Architecture**: Uses `@supabase/ssr` package with `createBrowserClient` for Client Components and `createServerClient` for Server Components/Route Handlers. Cookie-based session management is handled automatically.
- **Client Initialization**: Centralized in `src/lib/supabase.ts` per AGENTS.md, exporting `createClient()` (browser) and `createServerSupabase()` (server).
- **Type Generation**: Uses `supabase gen types typescript` to produce `src/lib/database.types.ts`, imported across the codebase.
- **RLS Strategy**: All tables enable RLS. Policies restrict CRUD to `authenticated` role where `user_id = auth.uid()`. No anonymous access to user data.
- **3D Interaction Model**: Planet components remain presentation-only. The `PlanetConfig` interface gains a `module` field (`ModuleType`). `NodeDetailPanel` becomes the interaction orchestrator, dispatching to either `router.push()` (for pipeline modules) or local state toggle (for Earth/Archive).
- **Route Restructure**: `/refinery` becomes `/analytical-pipeline` to align with the new module naming. The old route can redirect or be removed.
- **Archive Panel**: Implemented as an overlay panel (Z-Index 30) on the galaxy page, not a separate route. This preserves the spatial navigation metaphor.
- **Document Creation Flow**: Analytical Pipeline creates the `document` record at Phase D completion (not at session start), with `source_module = 'analytical-pipeline'`. The `analytical_session` record links back via `document_id`.

## Testing Decisions

- **Supabase Client**: Verify that `createClient` and `createServerSupabase` return properly typed clients with cookie adapters configured.
- **RLS Policies**: Test via Supabase test helpers (pgtap) that User A cannot read User B's documents or sessions.
- **Archive Panel**: Test that the panel fetches and renders documents from Supabase, handles empty states, and closes correctly.
- **3D Interaction**: Test that clicking Mars navigates to `/analytical-pipeline`, clicking Earth opens the Archive panel, and clicking other planets shows "coming soon" or no-ops.
- **Type Safety**: Ensure `database.types.ts` is regenerated whenever schema changes and that TypeScript compilation passes with zero errors.

## Open Questions

1. Should we implement anonymous/demo mode where unauthenticated users see sample documents? This would require relaxing RLS or a separate `demo_documents` table.
2. Should `documents` support soft deletes (e.g., `deleted_at` timestamp) or hard deletes?
3. Should the Archive panel support full-text search across `title` and `content_markdown`? This would require a Postgres `tsvector` column or Supabase Full Text Search.
