# live-text-from-image-translation

A React + Vite + Tailwind workspace for extracting text from manga/screenshots and preparing translation output.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Zustand (feature state)
- Tesseract.js 7 (browser OCR)
- Optional Manga OCR server adapter (through HTTP endpoint)
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
        ocr/
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
2. Choose OCR engine + OCR language + preprocessing settings.
3. Run OCR:
   - `Tesseract (Browser)` supports English/Japanese with bbox extraction.
   - `Manga OCR (Server)` supports Japanese via HTTP endpoint.
4. Choose translation target language and run translation adapter.
5. Render translated overlays at OCR bbox locations when OCR blocks are available.

The translation service currently ships with a placeholder adapter so you can safely plug in your preferred provider later in:

- `src/features/translator/services/translation.service.ts`
- `src/features/translator/constants/sample-ocr-blocks.ts` includes sample bbox test data for overlay alignment checks.

## Manga OCR Endpoint

Local development includes a built-in `POST /api/manga-ocr` endpoint (served by Vite) so the Manga OCR engine works out of the box with `npm run dev`.

If you want to use an external server instead, set:

```bash
VITE_MANGA_OCR_ENDPOINT=http://localhost:8000/api/manga-ocr
```

If this variable is unset, the app uses `/api/manga-ocr`.

Expected response payload can be one of:

- `{ "text": "..." }`
- `{ "result": { "text": "..." } }`
- `{ "lines": ["...", "..."] }`

Request payloads accepted by the built-in endpoint:

- `multipart/form-data` with `file` and optional `language` (`japanese` or `english`)
- `application/json` with `imageBase64` and optional `language`

Troubleshooting:

- `Failed to fetch` with `VITE_MANGA_OCR_ENDPOINT` set usually means that server is not running or blocked by CORS.
- Remove `VITE_MANGA_OCR_ENDPOINT` to fall back to the built-in local `/api/manga-ocr` endpoint.

## Next Production Steps

- Add real translation provider and API key management.
- Add bbox extraction to Manga OCR adapter (if your backend provides coordinates).
- Add unit tests for store actions and service adapters.
