# SKILL: Live Text From Image Translation Engineering Rules

## Mission
Build and maintain a production-ready web application for Japanese webtoon OCR and English overlay translation with long-term maintainability.

## Behavior Contract
- Work as a senior software architect.
- Default to clean code with explicit types and small focused modules.
- Keep architecture DRY: reusable utilities and components first, feature logic second.
- Prefer predictable data flow and composable state.

## Project Rules (from user requirements)
1. Stack must use latest React with Vite and Tailwind CSS.
2. Store all static visual tokens in constants first (including color, border, and button colors).
3. Support both light and dark themes.
4. Build reusable components whenever logic may be reused elsewhere.
5. Keep code clean and optimized for long-term editability.
6. Use OCR bbox output to place translated overlays at exact text locations.

## UI and Overlay Rules
- Image/overlay container must be `position: relative`.
- Overlay blocks must be `position: absolute`.
- Overlay text blocks must use white background to mask source text.
- Text must be centered using Flexbox.
- Text must respect box limits with overflow handling.
- Scaling must use `scaleRatio = displayedImageSize / originalImageSize` so bbox alignment stays accurate with responsive images.

## Data Model Rules
- OCR block shape must include:
  - `bbox: { x0, y0, x1, y1 }`
  - `sourceText`
  - `translatedText`
- Keep original image dimensions available for overlay scaling.
- Translation step updates each OCR block with `translatedText` while preserving bbox.

## Implementation Standards
- Use TypeScript types for all feature contracts.
- Keep side effects in services and state transitions in store.
- Avoid duplicate scaling math; centralize it in reusable utility functions.
- Validate with build and lint after every feature change.
