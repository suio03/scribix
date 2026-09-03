# Prism Pulse refinement review

Status: selected direction, refined for approval
Surface: public Scribix marketing homepage
Primary viewport: 1440px desktop
Compact verification viewport: 390 × 844

## Decisions preserved

- Violet-to-indigo is the primary brand/action family.
- Warm yellow identifies generated output, completion, and the important phrase in the promise.
- The homepage uses a luminous, energetic field rather than the existing parchment and terracotta system.
- The upload action stays inside the hero and remains the single dominant conversion.
- The source-to-output transformation is visible before deeper feature explanation.

## Refinements made

- Replaced a generic ambient gradient with a Scribix-specific split composition: one stable 16:9 source, a focused analysis beam, and ranked 9:16 candidates.
- Limited translucency and strong color to the marketing atmosphere. Upload, source, candidate, and workflow surfaces use stable semantic roles.
- Tightened the type hierarchy around one oversized promise, with technical labels reserved for media state and timing.
- Made the completed output visually independent of application theme. Candidate video color, captions, scores, and framing do not invert between Light and Dark.
- Added the selected direction’s first responsive transformation: the desktop source → beam → candidates row becomes a vertical sequence at 390px, while candidates remain visible together for comparison.

## Primary interaction contract

The prototype demonstrates one reversible, five-state upload interaction:

1. **Idle:** drop target and “Upload a video free.”
2. **Uploading:** filename, progress, secure-source message, and Cancel.
3. **Analyzing:** transcript words highlight while a word travels from source to candidates; Cancel remains available.
4. **Ready:** completion is explicit, ranked candidates appear from their source direction, and “Review clips” becomes primary.
5. **Error:** unsupported-format message and a direct recovery action.

Normal timing reaches Ready in 3.4 seconds in the demonstration. Slow review multiplies motion timing by 2.4 without changing state order. Cancel returns immediately to Idle. Reduced Motion removes travel, pulsing, and continuous highlights while preserving state and selection feedback.

## Theme contract in this prototype

- `canvas`: pale lavender / deep indigo
- `surface`: white translucent / indigo translucent
- `text`: ink / near-white
- `textSecondary`: muted plum / pale lavender
- `action`: saturated violet / brighter violet
- `generated`: warm yellow in both themes
- `success`: mint in both themes
- `danger`: raspberry in both themes

These are prototype roles, not final production tokens. Final semantic tokens and CSS custom properties are created only after approval.

## Approval decision

Approve the refined direction if the page now feels like the right Scribix brand and the balance of purple energy, yellow output emphasis, and neutral working surfaces is correct. Requested adjustments should name the element and desired change—for example “less yellow,” “make the headline calmer,” or “the dark theme should be less purple.”
