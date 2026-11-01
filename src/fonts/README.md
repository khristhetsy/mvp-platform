# Self-hosted fonts

These files are served from the repo through `next/font/local`, so the build never downloads fonts from Google.
All four families are licensed under the SIL Open Font License 1.1 (see the LICENSE files here).

| File | Family | Source package | Used for |
| --- | --- | --- | --- |
| Geist-Variable.woff2 | Geist (variable weight) | npm `geist` 1.9.0 | App text, `--font-geist-sans` |
| GeistMono-Variable.woff2 | Geist Mono (variable weight) | npm `geist` 1.9.0 | App code and numbers, `--font-geist-mono` |
| Archivo-latin-wght.woff2 | Archivo (variable weight, latin) | npm `@fontsource-variable/archivo` 5.3.0 | Marketing site headings |
| Inter-latin-wght.woff2 | Inter (variable weight, latin) | npm `@fontsource-variable/inter` 5.3.0 | Marketing site body |
| IBMPlexMono-latin-400/500/600.woff2 | IBM Plex Mono (latin) | npm `@fontsource/ibm-plex-mono` 5.3.0 | Marketing site labels and data |

To update a font, install the package above in a scratch folder and copy the matching woff2 file here.
