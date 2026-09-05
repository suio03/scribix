# Scribix Prism Pulse design system

Status: approved and applied across public, product, account, legal, and admin surfaces
Platform: responsive Next.js web product
Themes: light and dark

## Principles

1. **Show the transformation.** The signature composition is a stable 16:9 source, a focused AI analysis beam, and ranked 9:16 outputs.
2. **Color has a job.** Violet is action and selection, yellow is generated output or emphasis, mint is success, and raspberry is failure. Do not use these interchangeably.
3. **Energy around calm work.** Luminous color belongs to the marketing atmosphere. Upload, editing, and review surfaces stay stable and readable.
4. **Creative control remains visible.** Automation proposes; the user reviews, refines, and exports.
5. **Exports do not follow the app theme.** Video imagery, captions, crop, scores, and framing keep fixed colors in light and dark application themes.

## Typography

- Display and body: Geist Sans with variable weight.
- Technical labels, durations, scores, and state metadata: Geist Mono.
- Hero: `clamp(3.7rem, 7.5vw, 6.75rem)`, 0.90 line-height, `-0.072em` tracking, weight 720.
- Section title: `clamp(2.375rem, 4vw, 3.375rem)`, approximately 1.04 line-height.
- Body: 1rem–1.125rem, 1.65–1.75 line-height, 42–60 character measure.
- Avoid serif display type, all-caps paragraphs, and loose tracking on large headlines.

## Semantic color roles

The canonical values live in `tokens.json`. The web adapters live in `app/[locale]/globals.css`: `.prism-home` carries the expressive marketing layer, while `.home-refresh`, `.workspace-shell`, `.legal-surface`, `.admin-surface`, and `.extension-auth-page` tune the same semantic roles to each context.

- `canvas`: page background.
- `canvasDeep`: atmospheric gradient anchor.
- `surface`: translucent marketing surface.
- `surfaceSolid`: stable task/card surface.
- `surfaceMuted`: quiet section or control surface.
- `text`: primary copy.
- `textSecondary`: supporting copy.
- `border` / `borderStrong`: hierarchy and focus-adjacent separation.
- `action` / `actionHover` / `actionText`: primary interaction.
- `generated` / `generatedText`: AI output, selected candidate, and promise underline.
- `success`: completion, availability, and trust markers.
- `danger`: destructive/error status only.
- `inverseSurface` / `inverseText`: fixed dark media and proof stages in both themes.

## Surface intensity

- Marketing and public tool pages: full atmospheric gradients, transformation diagrams, and stronger violet/yellow moments.
- Dashboard, transcript, editor, billing, and account pages: calm canvas, white/deep-violet cards, restrained shadows, and color concentrated on actions and state.
- Legal and admin pages: typography, tokens, navigation, forms, and status colors only; no decorative product storytelling.
- Export previews and dark proof stages: fixed inverse palette so application theme changes never alter the represented media.

## Layout, spacing, and shape

- Primary container: 1240px maximum.
- Reading container: 680px maximum.
- Section spacing: 72–112px desktop, 64–80px compact.
- Space scale: 4, 8, 12, 16, 24, 32, 48, 72, 96.
- Radius: 12px controls, 20px cards, 32px stages, pill only for compact actions/status.
- Borders are one pixel. Elevation combines a soft violet-tinted shadow with a light inner edge.

## Materials and imagery

- The page may use two low-opacity radial fields and a masked 72px grid.
- Translucency is allowed on navigation, the upload module, and the transformation stage only.
- Product proof uses real Scribix source/output media. Separately labeled feature illustrations may use licensed source excerpts; preserve attribution and do not present them as completed project exports. See `docs/homepage-media.md`. Decorative synthetic video imagery should not replace real proof.
- Candidate content is a fixed export-preview material and does not invert in dark mode.

## Iconography

- Use Lucide outline icons at 1.5–1.9 stroke width.
- Icons support a named action or state; they do not decorate empty space.
- AI sparkle iconography appears only at the analysis handoff, not throughout every card.

## Brand mark

- The approved Scribix mark is A2 Leading Rail: an open, unequal-weight double-rail S.
- Product surfaces render the mark through `app/components/Logo.tsx` in the current ink color; violet remains reserved for actions and selection.
- Favicons and app icons use the fixed dark tile artwork and do not follow the application theme.
- Production SVG/PNG masters, minimum size, clear space, and misuse rules live in `logo-exploration-round-6/production/USAGE.md`.

## Motion

- Standard duration: 180–240ms for hover/focus, 520–700ms for entrance, 2.8s for the explanatory analysis loop.
- Standard easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Motion must communicate source-to-output direction or state. Avoid continuous movement on controls.
- Under `prefers-reduced-motion`, the beam and pulse become static while all state and selection cues remain.

## Primary interaction contract

1. Idle: accept drag/drop or file picker input.
2. Preparing/uploading: show filename and determinate progress when available.
3. Processing: show explicit processing copy and indeterminate progress.
4. Ready: route to the real clip workspace.
5. Error: retain the error message and direct retry, file-choice, or upgrade recovery.

The production homepage uses the existing upload pipeline; the design system changes its presentation, not its data or navigation behavior.

## Accessibility

- Use a 3px yellow focus ring on primary actions; preserve visible keyboard focus on every control.
- All primary pointer targets are at least 40px; mobile upload actions are 44px or taller.
- Do not rely on color alone: selected candidates have a border/ring and label; progress has text; errors have messages.
- `prefers-contrast: more` strengthens borders and secondary text.
- `prefers-reduced-transparency` replaces glass with solid surfaces.
- Reading and tab order follow the visible source → analysis → output sequence.

## Do / don't

- Do use violet for the one dominant action in a region.
- Do use yellow sparingly for generated results and the promise highlight.
- Do keep proof/editor stages dark and media-led in both themes.
- Do keep mobile candidates visible together so comparison remains clear.
- Don't turn every surface into purple glass.
- Don't use yellow as a general CTA color or mint as decoration.
- Don't invert exported media when application theme changes.
- Don't add generic sparkle ornaments where no AI state is being explained.

## Reference attribution

The direction combines [Vizard](https://vizard.ai/) for energetic in-hero action, [Figma](https://www.figma.com/design/) for controlled chromatic fields, and [OpusClip](https://www.opus.pro/) for visible source/output proof. Principles were adapted to Scribix; no reference layout, copy, mark, or screenshot was copied.
