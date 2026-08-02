# Event photography — drop curated stills here

The `EventGallery` component renders whatever images live in this folder
(`public/marketing/events/`). It's empty by design until real, **cleared**
conference photography is added — see spec §16.

## How to add photos

1. **Consent first.** These are photos of identifiable attendees. Confirm event
   photography consent covers marketing use before adding any (§16). Prefer wide
   or partially-obscured shots over close portraits of individuals.
2. **Curate 8–10 stills** per the §16 brief: a founder mid-presentation with a
   deck visible, a wide filled-room shot, two or three networking/conversation
   shots, and a venue/signage shot. Landscape, faces in focus, no empty chairs.
3. **Process** each: resize to 1600px on the long edge, convert to **WebP q80**,
   strip EXIF. Example with ImageMagick:
   ```bash
   magick input.jpg -resize 1600x1600\> -strip -quality 80 output.webp
   ```
4. **Name them** so display order is the sort order, e.g. `01-keynote.webp`,
   `02-room.webp`, `03-networking.webp`.
5. Drop the `.webp` files in this folder and commit. They appear automatically on
   the home gallery (and anywhere else `EventGallery` is used) after the next
   build — no code changes needed.

Source archive (Google Drive, §16): *iCFO Media - Conference - 2008 to 2019*.
