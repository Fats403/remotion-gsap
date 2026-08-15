# remotion-gsap

Deterministic GSAP timelines for Remotion.

![Kinetic type choreographed with one GSAP timeline](https://raw.githubusercontent.com/Fats403/remotion-gsap/main/assets/kinetic.gif)

## The problem

Remotion makes frame-based animation predictable. Complex choreography can still become difficult to maintain once a scene has overlapping entrances, labels, staggers, transforms, and transitions.

GSAP has a strong timeline API for that work. `remotion-gsap` connects it to Remotion without giving up deterministic rendering.

Remotion remains the clock. GSAP describes the motion.

## Why not just play() the timeline?

GSAP normally advances on its own requestAnimationFrame ticker. That looks right in Studio preview and breaks in `renderMedia()`, where frames are captured headlessly, concurrently, and out of order. A ticker-driven timeline produces different pixels on different runs.

This hook never lets the ticker run. It seeks a paused timeline, so every frame is a pure function of the frame number, no matter what order frames render in or how many render at once.

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

The hook creates one scoped, paused GSAP timeline. On each Remotion frame, it seeks the timeline to `frame / fps`. Playback, manual seeking (`seek`, `time`, `totalTime`, `progress`, `tweenTo`, and related methods), pause-state mutation, and cleanup are package-owned and rejected inside builders.

Use GSAP labels, position parameters, staggers, keyframes, repeats, yoyo, CSS transforms, SVG attributes, and nested timelines as usual.

## Demos

Each of these is one `useGsapTimeline` builder, rendered with the standard Remotion renderer.

![Dashboard choreography](https://raw.githubusercontent.com/Fats403/remotion-gsap/main/assets/dashboard.gif)

Staggered card entrances and SVG chart draw-ins, sequenced with labels and position parameters.

![Scene transition](https://raw.githubusercontent.com/Fats403/remotion-gsap/main/assets/transition.gif)

Scene-to-scene clip-path wipes and staggered reveals, with repeat and yoyo accents.

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
