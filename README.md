# remotion-gsap

Deterministic GSAP timelines for Remotion.

## The problem

Remotion makes frame-based animation predictable. Complex choreography can still become difficult to maintain once a scene has overlapping entrances, labels, staggers, transforms, and transitions.

GSAP has a strong timeline API for that work. `remotion-gsap` connects it to Remotion without giving up deterministic rendering.

Remotion remains the clock. GSAP describes the motion.

## Install

```sh
npm install remotion-gsap gsap
```

Requires GSAP 3.12+, React 18 or 19, and Remotion 4.

## Example

```tsx
import {AbsoluteFill} from 'remotion';
import {useGsapTimeline} from 'remotion-gsap';

export const Scene = () => {
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
        {
          y: 80,
          opacity: 0,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power3.out',
        },
        '-=0.3',
      );
  });

  return (
    <AbsoluteFill ref={scope}>
      <h1 data-title>Build better timelines</h1>
      <div data-card>One</div>
      <div data-card>Two</div>
    </AbsoluteFill>
  );
};
```

The hook creates one scoped, paused GSAP timeline. On each Remotion frame, it seeks the timeline to `frame / fps`.

Use GSAP labels, position parameters, staggers, keyframes, repeats, yoyo, CSS transforms, SVG attributes, and nested timelines as usual.

## Dynamic values

Pass values used to build the timeline as dependencies:

```tsx
const scope = useGsapTimeline<HTMLDivElement>(
  ({timeline, selector}) => {
    timeline.to(selector('[data-card]'), {x: distance, duration: 1});
  },
  {dependencies: [distance]},
);
```

## Rules

- Let Remotion own time, sequences, audio, video, captions, and composition duration.
- Use the provided selector or direct refs. Avoid global selectors.
- Keep timeline builders synchronous.
- Do not call GSAP playback methods or start the GSAP ticker.
- Do not use timeline callbacks for render-time side effects.
- Keep React and GSAP from writing the same animated inline property.
- Treat GSAP plugins as unsupported until they have renderer parity tests.

The adapter rejects playback, asynchronous builders, and timeline callbacks that can make rendering order-dependent.

## Agent skill

The package includes an agent skill at [`SKILL.md`](./SKILL.md).

Give the skill to your coding agent when generating Remotion compositions. It covers the adapter API, safe GSAP patterns, and common determinism pitfalls.

```sh
npx skills add Fats403/remotion-gsap
```

## Tested behavior

- Direct, sequential, backward, and repeated frame access
- Serial and concurrent renderer execution
- React 18 and 19
- Nested and overlapping Remotion sequences
- HTML and SVG scope roots
- 24, 30, and 60 fps compositions
- Packed npm consumer imports and types

## License

MIT. This package is unofficial and is not affiliated with Remotion or GreenSock.
