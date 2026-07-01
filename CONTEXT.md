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

**Exocortex**:
An externalised knowledge workspace that lets the user retrieve, inspect, and navigate previously ingested knowledge.

**Retrieval**:
A search interaction that turns a user question into ranked knowledge fragments from the Exocortex.

**Search Result**:
A ranked knowledge fragment returned by a Retrieval. It carries enough source context for the user to evaluate where the fragment came from.

**Hit@1**:
The highest-ranked Search Result for a Retrieval.

**Generation**:
An answer synthesis step that uses the user's question and Search Results to produce a grounded natural-language response.

**Intelligence Source**:
An external RSS/news feed registered once and shared by intelligence Modules.

**Source Strategy**:
A Module-specific filtering, scoring, selection, or extraction rule applied to shared Intelligence Sources.

**Social Signal**:
A real-time public-discussion artifact captured from a social platform because it may reveal sentiment, attention, narrative change, or weak signals.
_Avoid_: authoritative source, verified fact

**Signal Item**:
A single normalized Social Signal stored in the shared signal repository.
_Avoid_: post-only record

**Watch Rule**:
A saved query, account target, or topic instruction used to capture Social Signals.
_Avoid_: scraper config

**Signal Board**:
A Module view that filters Signal Items into a decision-oriented dashboard.
_Avoid_: report page

## Relationships

- A **Planet** provides access to exactly one **Module**
- A **Module** can produce multiple **Documents**
- An **Analytical Session** generates exactly one **Document**
- A **Document** belongs to exactly one **Module** (via `source_module`)
- A **Retrieval** can return multiple **Search Results**
- A **Hit@1** belongs to exactly one **Retrieval**
- A **Generation** is grounded in one **Retrieval**
- Multiple **Modules** can share the same **Intelligence Source**
- A **Source Strategy** belongs to exactly one **Module**
- A **Watch Rule** can produce multiple **Signal Items**
- A **Signal Board** presents a filtered set of **Signal Items**

## Example dialogue

> **Dev:** "When a user clicks Mars, do we create the Analytical Session immediately?"
> **Domain expert:** "No — we navigate to the pipeline interface first. The Session is only created when they submit their initial issue and Phase A begins."
