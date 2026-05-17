# Polymorphic Document Storage with Module-Specific Process Tables

We use a central `documents` table for all final outputs, paired with module-specific tables (e.g., `analytical_sessions`) for process metadata. This avoids schema fragmentation while preserving the ability to reconstruct how each document was produced.

**Why not separate tables per module?**
- Most queries are "show me all my documents" regardless of source
- Prevents JOIN complexity when browsing the Archive

**Why not a single table with nullable columns?**
- Module-specific data has different shapes and validation rules
- Keeps the `documents` table clean and query-performant

**Trade-off**: Reconstructing a full session requires querying two tables. We accept this because session reconstruction is a rare operation (only when user clicks "view reasoning chain").
