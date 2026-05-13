# Exocortex 3D Galaxy Project Guidelines

## 🛠 Project Stack
- **Framework**: Next.js (App Router)
- **3D Engine**: @react-three/fiber + @react-three/drei (Three.js)
- **Styling**: Tailwind CSS (HUD Overlays only)
- **Animations**: Framer Motion 3D
- **Type Safety**: Strict TypeScript (Matt Pocock Style)

## 🏛 Architecture Patterns
- **Canvas-First**: `page.tsx` should only contain the `<Canvas>` and HUD containers.
- **Component Splitting**: Each celestial body (Star, Planet, Belt) must be a separate file in `src/components/canvas/`.
- **Z-Index Strategy**:
  - Z-Index 0: Three.js Canvas (Background/World)
  - Z-Index 10: HUD Overlays (HTML UI)

## 🧩 TypeScript Standards (Matt Pocock Style)
- **Ref Typing**: Always use explicit Three.js types for refs (e.g., `useRef<THREE.Group>(null!)`).
- **Props Interfaces**: Use `interface` for component props; prefer exhaustive typing over `any`.
- **Zero-Assertion**: Avoid `as any`. Use type guards if necessary.
- **Utility Types**: Leverage `ComponentPropsWithoutRef` for R3F elements.

## 🌌 Performance Strategy (8GB RAM Device Optimization)
- **Instancing**: Use `Instances` or `Merged` for repetitive objects like asteroids or starfields.
- **Asset Management**: Always use `useGLTF.preload` for 3D models.
- **Frame Looping**: Use `useFrame` sparingly; move non-per-frame logic out of the loop.
- **Memory Management**: Dispose of geometries and materials on unmount.

## 🤖 Agent Workflow (Orchestration)
- **GitNexus Integration**: Before proposing large structural changes, use GitNexus MCP to analyze the current component graph.
- **OpenCode Execution**: OpenCode is responsible for physical file creation and package installation.
- **Step-by-step Implementation**: 
  1. Define types/interfaces.
  2. Implement 3D logic.
  3. Implement HUD interaction.
  4. Perform strict type check (`tsc --noEmit`).