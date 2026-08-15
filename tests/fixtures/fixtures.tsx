import {AbsoluteFill, Sequence} from 'remotion';
import {useGsapTimeline} from '../../src';

const OpacityFixture = () => {
  const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
    timeline.fromTo(
      selector('[data-red]'),
      {opacity: 0},
      {opacity: 1, duration: 1, ease: 'none'},
    );
  });

  return (
    <AbsoluteFill ref={scope} style={{background: '#000'}}>
      <AbsoluteFill data-red style={{background: '#f00'}} />
    </AbsoluteFill>
  );
};

export const FpsFixture = () => <OpacityFixture />;

export const SequenceFixture = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <Sequence from={30} durationInFrames={45} premountFor={10}>
      <OpacityFixture />
    </Sequence>
  </AbsoluteFill>
);

export const NestedSequenceFixture = () => (
  <AbsoluteFill style={{background: '#000'}}>
    <Sequence from={20} durationInFrames={60} premountFor={10}>
      <Sequence from={10} durationInFrames={45} premountFor={5}>
        <OpacityFixture />
      </Sequence>
    </Sequence>
  </AbsoluteFill>
);

export const SurfaceFixture = () => {
  const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
    timeline
      .set(selector('[data-panel]'), {opacity: 1, '--hue': 20})
      .to(
        selector('[data-panel]'),
        {
          x: 150,
          rotation: 270,
          borderRadius: 44,
          '--hue': 280,
          duration: 2,
          ease: 'none',
        },
        0,
      )
      .to(
        selector('[data-svg-rect]'),
        {
          attr: {x: 188, rx: 24, fill: '#B8FF5A'},
          rotation: 90,
          transformOrigin: '50% 50%',
          duration: 2,
          ease: 'power2.inOut',
        },
        0,
      )
      .to(
        selector('[data-pulse]'),
        {
          scale: 1.5,
          repeat: 1,
          yoyo: true,
          duration: 0.5,
          ease: 'sine.inOut',
        },
        0.25,
      )
      .to(
        selector('[data-keyframe]'),
        {
          keyframes: [
            {y: -34, rotation: -20},
            {x: 80, y: 0, rotation: 20},
            {x: 160, y: -20, rotation: 0},
          ],
          duration: 2,
          ease: 'none',
        },
        0,
      );
  });

  return (
    <AbsoluteFill ref={scope} style={{background: '#080910', overflow: 'hidden'}}>
      <div
        data-panel
        style={{
          '--hue': 20,
          position: 'absolute',
          width: 72,
          height: 72,
          left: 32,
          top: 26,
          opacity: 0,
          background: 'hsl(var(--hue) 90% 55%)',
        } as React.CSSProperties}
      />
      <svg width="320" height="180" viewBox="0 0 320 180">
        <rect data-svg-rect x="24" y="118" width="66" height="30" rx="2" fill="#7C5CFF" />
        <circle data-pulse cx="270" cy="45" r="16" fill="#FF5F8F" />
      </svg>
      <div
        data-keyframe
        style={{
          position: 'absolute',
          width: 24,
          height: 24,
          left: 65,
          bottom: 12,
          background: '#fff',
        }}
      />
    </AbsoluteFill>
  );
};

const OverlapLayer = ({color, direction}: {color: string; direction: number}) => {
  const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
    timeline.fromTo(
      selector('[data-layer]'),
      {x: direction * 130, opacity: 0, scale: 0.6},
      {x: 0, opacity: 0.82, scale: 1, duration: 1, ease: 'power3.out'},
    );
  });

  return (
    <AbsoluteFill ref={scope} style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        data-layer
        style={{width: 150, height: 90, borderRadius: 28, background: color, mixBlendMode: 'screen'}}
      />
    </AbsoluteFill>
  );
};

export const OverlapFixture = () => (
  <AbsoluteFill style={{background: '#05060B'}}>
    <Sequence from={10} durationInFrames={55} premountFor={10}>
      <OverlapLayer color="#7C5CFF" direction={-1} />
    </Sequence>
    <Sequence from={30} durationInFrames={55} premountFor={10}>
      <OverlapLayer color="#FF5F8F" direction={1} />
    </Sequence>
  </AbsoluteFill>
);

export const SamePropertyOverlapFixture = () => {
  const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
    // Two tweens fighting over the same property with overlapping windows:
    // the second tween's start value is recorded lazily at first
    // initialization, which made frame state depend on the frame-visit path
    // before the adapter primed in playback order and rendered forward from
    // zero. This fixture keeps that guarantee honest in the real renderer.
    timeline.to(selector('[data-contested]'), {x: 200, duration: 1, ease: 'none'}, 0);
    timeline.to(selector('[data-contested]'), {x: 0, duration: 1, ease: 'none'}, 0.5);
  });

  return (
    <AbsoluteFill ref={scope} style={{background: '#05060B'}}>
      <div
        data-contested
        style={{width: 60, height: 60, borderRadius: 12, background: '#B8FF5A'}}
      />
    </AbsoluteFill>
  );
};

export const SvgRootFixture = () => {
  const scope = useGsapTimeline<SVGSVGElement>(({timeline, selector}) =>
    timeline.to(selector('[data-root-circle]'), {
      attr: {cx: 80, fill: '#B8FF5A'},
      duration: 1,
      ease: 'none',
    }),
  );

  return (
    <svg ref={scope} width="100" height="100" viewBox="0 0 100 100" style={{background: '#000'}}>
      <circle data-root-circle cx="20" cy="50" r="14" fill="#7C5CFF" />
    </svg>
  );
};
