# שעשועון השין

A small iPad web app for daily practice of the Hebrew letter ש (for a child who says it closer to ס).
It is built so the child never has to read: every sentence is heard and seen, then said.

- **Hear, see, say.** A parent (or the speech therapist) records each sentence once in the app's
  recording studio. The child hears the recording, sees a picture (her own drawing, or an emoji
  scene until she draws one), says the sentence, hears herself, and rates how it came out.
  Long sentences are practised piece by piece: the app cuts the recording where the reader paused.
- **A puppy guide.** A puppy walks along the bottom of the screen and points at the next thing to
  do. Every try earns a treat (effort, not perfection). In the puppy's house she feeds it, and each
  level unlocks a trick, a dress-up item or a colour. Every trick is triggered by saying a command
  with ש out loud.
- Each session runs about 20 minutes: a mirror warm-up, a ש/ס listening game, sentence cards, and
  drawing.
- No server and no accounts. Progress, drawings and recordings stay on the device (localStorage and
  IndexedDB). Works offline after the first visit. On iPad: open in Safari, then Share → Add to Home Screen.
- Recording and the camera mirror need HTTPS (GitHub Pages provides it).
- The sentence list is in `data.js` and can be edited in the parent area (long-press "להורים").

Files: `index.html`, `styles.css`, `app.js` (the app), `pup.js` (the puppy drawing and its
animations), `cut.js` (finds the spoken parts of a recording), `data.js` (sentences, treats,
tricks), `sw.js` (offline cache).
