# public/

Vite serves this folder at the site root: `public/logo.png` → `https://localhost:5173/logo.png`.

## Add your brand logo

Save your image here as **`logo.png`** (the holographic B sticker, or any logo).

- Recommended: 256×256 px or larger, square
- PNG with transparent background works best
- If your image has a **black background**, BrandLogo will hide it via CSS
  `mix-blend-mode: screen` so it blends cleanly on dark UI

Once `logo.png` is in this folder, refresh the page — LoginPage and Sidebar
will show your image. If the file is missing, BrandLogo falls back to the
generated holographic CSS version automatically.
