# Knowledge Galaxy

A 3D solar system visualization where each planet represents a distinct application module for knowledge processing and management.

## Language

**Planet**:
A celestial body in the 3D visualization that serves as an entry point to an application module. Not to be confused with astronomical planets.

**Module**:
A functional application unit (e.g., Archive, Analytical Pipeline, Knowledge Graph) accessed through a Planet.

**Session**:
A single execution run of a module's workflow. For the Analytical Pipeline, this is one complete A→B→C→D cycle.

**Document**:
A persisted piece of content in Markdown format, stored in the central Archive. All modules produce Documents as their final output.

**Archive**:
The central document repository (Earth module) where all generated content is aggregated and browsable.

## Relationships

- A **Planet** provides access to exactly one **Module**
- A **Module** can produce multiple **Documents**
- An **Analytical Session** generates exactly one **Document**
- A **Document** belongs to exactly one **Module** (via `source_module`)

## Example dialogue

> **Dev:** "When a user clicks Mars, do we create the Analytical Session immediately?"
> **Domain expert:** "No — we navigate to the pipeline interface first. The Session is only created when they submit their initial issue and Phase A begins."
