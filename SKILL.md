---
name: remotion-gsap
description: Build and revise deterministic GSAP timeline animations inside Remotion compositions using the remotion-gsap adapter. Use for complex Remotion choreography involving overlapping entrances, labels, staggers, nested timelines, CSS or SVG transforms, and transitions where GSAP should describe motion while Remotion remains the frame clock.
---

# remotion-gsap

Use `remotion-gsap` as the only bridge between the current Remotion frame and GSAP. Let GSAP describe choreography; let Remotion own time, media, sequences, and rendering.

Do not use `@gsap/react`, `useGSAP()`, or a second frame-seeking effect in the same scene.

## Build the timeline

Attach the returned ref to one stable scene wrapper. Select descendants through the scoped selector:

```tsx
const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
  timeline
    .from(selector('[data-title]'), {
      yPercent: 120,
      opacity: 0,
      duration: 0.8,
      ease: 'power4.out',
    })
    .from(
      selector('[data-card]'),
      {y: 80, opacity: 0, stagger: 0.08, duration: 0.6},
      '-=0.3',
    );
});

return <AbsoluteFill ref={scope}>{/* scoped targets */}</AbsoluteFill>;
```

Use GSAP labels and position parameters instead of manually calculating many frame ranges. Use nested timelines when a group has reusable internal choreography. Mark selector hooks with `data-*` attributes as shown; bare invented attributes are invalid DOM and React warns on them.

Pass every prop used to construct the timeline as an explicit dependency:

```tsx
useGsapTimeline(buildTimeline, {dependencies: [headline, accentColor]});
```

Keep the builder synchronous. Load data and fonts before rendering the composition. The adapter rejects Promise-returning builders.

## Preserve determinism

- Never call `play()`, `resume()`, `restart()`, `reverse()`, `paused(false)`, or start a GSAP ticker.
- Never advance animations with `Date`, `performance.now`, timers, requestAnimationFrame, or wall-clock state.
- Never use unseeded randomness. Derive stable values from data or Remotion's seeded `random()`. The adapter rejects GSAP's `"random(...)"` string values, random-order staggers, and `repeatRefresh`.
- Do not use ScrollTrigger, Draggable, Observer, pointer events, or viewport interaction to control rendered animation.
- Do not use `onStart`, `onUpdate`, `onComplete`, `onRepeat`, `onReverseComplete`, `onInterrupt`, `.call()`, `.then()`, `eventCallback()`, or callback-based side effects. The adapter rejects timeline callbacks.
- Keep `<Sequence>`, audio, video, captions, and composition duration in Remotion.
- Animate dedicated wrappers. Do not make React and GSAP write the same inline property; context cleanup removes GSAP-owned inline values during rebuilds.
- Scope targets with the provided selector or direct refs. Do not use document-global selectors.
- Tween DOM or SVG elements only; the adapter rejects plain-object tween targets. Tweening a plain object that JSX reads animates in the Player but freezes in stills and renders. Derive numeric values from `useCurrentFrame()` and `interpolate()` instead.
- Attach every animation to the provided timeline. The adapter rejects freestanding tweens, `delayedCall`, and ticker callbacks created in the builder; a plain zero-duration `gsap.set` for static state is allowed.

The same frame must produce the same DOM state when visited directly, sequentially, backward, repeatedly, or in another renderer process.

## Choose safe GSAP features

Prefer core timeline operations: `to`, `from`, `fromTo`, `set`, labels, position parameters, staggers, keyframes, eases, repeats, yoyo, CSS transforms, CSS variables, SVG attributes, and nested timelines. The scope ref may target an HTML or SVG element.

Treat plugins as unsupported until the project has an actual Remotion renderer parity test for that plugin. Do not infer render safety merely because a plugin works during browser playback.

For SVG stroke draws, measure `path.getTotalLength()` inside the builder and let GSAP own both `strokeDasharray` and `strokeDashoffset`; combining the `pathLength` attribute with GSAP-driven dash offsets renders as a binary jump instead of a progressive draw. Keep numeric counters and other changing text in Remotion, derived from `useCurrentFrame()` on a React-owned node; timeline callbacks and text plugins are unavailable.

## Verify the result

Run the package checks when working in this repository:

```sh
pnpm test
pnpm test:consumer
pnpm test:renderer
```

For consumer compositions, inspect frames reached in a shuffled order and render at concurrency greater than one. Compare direct stills with the corresponding frames from a full render. Test at least the start, overlap boundaries, midpoint, outro, and final frame.
