# live-text-from-image-translation

A React + Vite + Tailwind workspace for extracting Japanese webtoon text from images and preparing English translation output.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Zustand (feature state)
- Tesseract.js 7 (OCR)
- `class-variance-authority` + `clsx` + `tailwind-merge` (DRY UI variants)

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Architecture

```text
src/
  components/
    layout/
    ui/
  constants/
    app.constants.ts
    theme.constants.ts
  features/
    translator/
      components/
      services/
      store/
      types.ts
  lib/
  theme/
```

## Theming Design

- All static visual colors are centralized in `src/constants/theme.constants.ts`.
- Light/dark palettes are mapped to CSS variables through `resolveThemeVariables`.
- Theme state and persistence live in `src/theme/theme-provider.tsx` + `src/theme/theme-manager.ts`.
- Tailwind utility classes consume CSS variables to keep design tokens reusable and maintainable.

## OCR and Translation Flow

1. Upload an image in the source panel.
2. Run OCR with Tesseract.js (`jpn + jpn_vert`) using multi-pass preprocessing and bbox extraction.
3. Translate text using the translation adapter.
4. Render translated overlays at OCR bbox locations using responsive scale-ratio alignment.

The translation service currently ships with a placeholder adapter so you can safely plug in your preferred provider later in:

- `src/features/translator/services/translation.service.ts`
- `src/features/translator/constants/sample-ocr-blocks.ts` includes sample bbox test data for overlay alignment checks.

## Next Production Steps

- Add real translation provider and API key management.
- Add speech bubble-level grouping/merging heuristics on top of OCR paragraph boxes.
- Add unit tests for store actions and service adapters.
