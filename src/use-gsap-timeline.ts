import {gsap} from 'gsap';
import {type DependencyList, useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {frameToSeconds} from './frame-time';

export type GsapTimelineBuildContext<T extends Element> = {
  /** A package-owned timeline that is already paused at time zero. */
  timeline: gsap.core.Timeline;
  /** The mounted element attached to the returned ref. */
  scope: T;
  /** A GSAP selector restricted to descendants of the scope element. */
  selector: gsap.utils.SelectorFunc;
};

export type GsapTimelineBuilder<T extends Element> = (
  context: GsapTimelineBuildContext<T>,
) => unknown;

export type UseGsapTimelineOptions = {
  /** Rebuild the timeline when one of these values changes. */
  dependencies?: DependencyList;
};

/** A React 18/19-compatible object ref for the scoped HTML or SVG root. */
export type GsapScopeRef<T extends Element> = {
  current: T | null;
};

const EMPTY_DEPENDENCIES: DependencyList = [];
const CALLBACK_KEYS = [
  'onStart',
  'onUpdate',
  'onComplete',
  'onRepeat',
  'onReverseComplete',
  'onInterrupt',
] as const;

const getTimelineAnimations = (timeline: gsap.core.Timeline): gsap.core.Animation[] => [
  timeline,
  ...timeline.getChildren(true, true, true),
];

const animationVars = (animation: gsap.core.Animation): Record<string, unknown> =>
  (animation as gsap.core.Animation & {vars: Record<string, unknown>}).vars;

const findCallbacksInValue = (value: unknown, seen = new Set<object>()): string[] => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return [];
  }

  seen.add(value);
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value);
  const found: string[] = [];

  for (const [key, nestedValue] of entries) {
    if (
      CALLBACK_KEYS.includes(key as (typeof CALLBACK_KEYS)[number]) &&
      typeof nestedValue === 'function'
    ) {
      found.push(key);
    }
    found.push(...findCallbacksInValue(nestedValue, seen));
  }

  return [...new Set(found)];
};

const findTimelineCallbacks = (timeline: gsap.core.Timeline): string[] => {
  const animations = getTimelineAnimations(timeline);
  return [...new Set(animations.flatMap((animation) => findCallbacksInValue(animationVars(animation))))];
};

const assertNoCallbacks = (value: unknown) => {
  const callbacks = findCallbacksInValue(value);
  if (callbacks.length > 0) {
    throw new Error(
      `useGsapTimeline does not allow timeline callbacks (${callbacks.join(', ')}). Derive visual state from the timeline instead of side effects.`,
    );
  }
};

type TimelineControls = {
  isPaused: () => boolean;
  pause: () => void;
  renderAt: (seconds: number) => void;
  restoreForContextRevert: () => void;
  kill: () => void;
};

const guardTimelineMethods = (
  timeline: gsap.core.Timeline,
): TimelineControls => {
  // Bind the package-owned controls before replacing the public methods the
  // builder receives. Internal frame seeking and cleanup must remain possible
  // without giving user code a second clock.
  const originalPaused = timeline.paused.bind(timeline);
  const originalTotalTime = timeline.totalTime.bind(timeline);
  const originalKill = timeline.kill.bind(timeline);

  const playbackError = () => {
    throw new Error(
      'useGsapTimeline builders must not start playback. Remove play(), resume(), restart(), reverse(), or paused(false).',
    );
  };

  timeline.play = playbackError as typeof timeline.play;
  timeline.resume = playbackError as typeof timeline.resume;
  timeline.restart = playbackError as typeof timeline.restart;
  timeline.reverse = playbackError as typeof timeline.reverse;
  timeline.pause = (() => {
    throw new Error(
      'useGsapTimeline owns timeline pause state. Do not call timeline.pause() inside the builder.',
    );
  }) as typeof timeline.pause;

  timeline.paused = ((value?: boolean) => {
    if (value === false) {
      return playbackError();
    }
    if (value !== undefined) {
      throw new Error(
        'useGsapTimeline owns timeline pause state. Read timeline.paused() if needed, but do not set it.',
      );
    }
    return originalPaused();
  }) as typeof timeline.paused;

  const seekingError = () => {
    throw new Error(
      'useGsapTimeline owns timeline seeking. Remove seek(), time(), totalTime(), progress(), totalProgress(), tweenTo(), or tweenFromTo() from the builder.',
    );
  };

  timeline.seek = seekingError as typeof timeline.seek;
  timeline.time = seekingError as typeof timeline.time;
  timeline.totalTime = seekingError as typeof timeline.totalTime;
  timeline.progress = seekingError as typeof timeline.progress;
  timeline.totalProgress = seekingError as typeof timeline.totalProgress;
  timeline.tweenTo = seekingError as typeof timeline.tweenTo;
  timeline.tweenFromTo = seekingError as typeof timeline.tweenFromTo;
  timeline.kill = (() => {
    throw new Error(
      'useGsapTimeline owns timeline cleanup. Do not call timeline.kill() inside the builder.',
    );
  }) as typeof timeline.kill;

  const originalEventCallback = timeline.eventCallback.bind(timeline) as (
    ...args: unknown[]
  ) => unknown;
  timeline.eventCallback = ((...args: unknown[]) => {
    if (args.length > 1 && typeof args[1] === 'function') {
      throw new Error('useGsapTimeline does not allow timeline.eventCallback().');
    }
    return originalEventCallback(...args);
  }) as typeof timeline.eventCallback;

  timeline.then = (() => {
    throw new Error('useGsapTimeline does not allow timeline.then() callbacks.');
  }) as typeof timeline.then;

  const originalTo = timeline.to.bind(timeline);
  timeline.to = ((...args: Parameters<typeof timeline.to>) => {
    assertNoCallbacks(args[1]);
    return originalTo(...args);
  }) as typeof timeline.to;

  const originalFrom = timeline.from.bind(timeline);
  timeline.from = ((...args: Parameters<typeof timeline.from>) => {
    assertNoCallbacks(args[1]);
    return originalFrom(...args);
  }) as typeof timeline.from;

  const originalFromTo = timeline.fromTo.bind(timeline);
  timeline.fromTo = ((...args: Parameters<typeof timeline.fromTo>) => {
    assertNoCallbacks(args[1]);
    assertNoCallbacks(args[2]);
    return originalFromTo(...args);
  }) as typeof timeline.fromTo;

  const originalSet = timeline.set.bind(timeline);
  timeline.set = ((...args: Parameters<typeof timeline.set>) => {
    assertNoCallbacks(args[1]);
    return originalSet(...args);
  }) as typeof timeline.set;

  const originalAdd = timeline.add.bind(timeline);
  timeline.add = ((...args: Parameters<typeof timeline.add>) => {
    if (typeof args[0] === 'function') {
      throw new Error(
        'useGsapTimeline does not allow callback functions in timeline.add().',
      );
    }
    return originalAdd(...args);
  }) as typeof timeline.add;

  timeline.call = (() => {
    throw new Error('useGsapTimeline does not allow timeline.call().');
  }) as typeof timeline.call;

  return {
    isPaused: () => originalPaused(),
    pause: () => {
      originalPaused(true);
    },
    renderAt: (seconds) => {
      originalTotalTime(seconds, true);
    },
    restoreForContextRevert: () => {
      // gsap.context().revert() calls animation.kill(), which in turn reaches
      // public progress/time methods. Remove every instance-level guard only
      // after builder execution is permanently over so GSAP teardown can use
      // its untouched prototype implementation.
      for (const method of [
        "play",
        "resume",
        "restart",
        "reverse",
        "pause",
        "paused",
        "seek",
        "time",
        "totalTime",
        "progress",
        "totalProgress",
        "tweenTo",
        "tweenFromTo",
        "kill",
        "eventCallback",
        "then",
        "to",
        "from",
        "fromTo",
        "set",
        "add",
        "call",
      ]) {
        delete (timeline as unknown as Record<string, unknown>)[method];
      }
    },
    kill: () => {
      originalKill();
    },
  };
};

/**
 * Builds one scoped, paused GSAP timeline and seeks it from Remotion's frame.
 * The hook never plays the timeline on GSAP's ticker.
 */
export const useGsapTimeline = <T extends Element>(
  build: GsapTimelineBuilder<T>,
  {dependencies = EMPTY_DEPENDENCIES}: UseGsapTimelineOptions = {},
): GsapScopeRef<T> => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scopeRef = useRef<T>(null);
  const controlsRef = useRef<TimelineControls | null>(null);
  const buildRef = useRef(build);
  const frameRef = useRef(frame);
  const fpsRef = useRef(fps);

  buildRef.current = build;
  frameRef.current = frame;
  fpsRef.current = fps;

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) {
      return;
    }

    const state: {
      timeline: gsap.core.Timeline | null;
      controls: TimelineControls | null;
    } = {timeline: null, controls: null};
    const context = gsap.context(() => undefined, scope);

    try {
      context.add(() => {
        state.timeline = gsap.timeline({paused: true});
        state.controls = guardTimelineMethods(state.timeline);
        const selector = gsap.utils.selector(scope);

        const result = buildRef.current({timeline: state.timeline, scope, selector});

        if (!state.controls.isPaused()) {
          throw new Error(
            'useGsapTimeline builders must not start playback. Remove play(), resume(), restart(), or reverse().',
          );
        }

        if (
          result !== state.timeline &&
          typeof result === 'object' &&
          result !== null &&
          'then' in result &&
          typeof result.then === 'function'
        ) {
          throw new TypeError(
            'useGsapTimeline builders must be synchronous. Load data before building the timeline.',
          );
        }

        const callbacks = findTimelineCallbacks(state.timeline);
        if (callbacks.length > 0) {
          throw new Error(
            `useGsapTimeline does not allow timeline callbacks (${callbacks.join(', ')}). Derive visual state from the timeline instead of side effects.`,
          );
        }

        // Builders only describe motion. Reassert package ownership of playback.
        state.controls.pause();
        state.controls.renderAt(
          frameToSeconds(frameRef.current, fpsRef.current),
        );
      });

      controlsRef.current = state.controls;
    } catch (error) {
      state.controls?.restoreForContextRevert();
      context.revert();
      state.controls?.kill();
      throw error;
    }

    return () => {
      controlsRef.current = null;
      state.controls?.restoreForContextRevert();
      context.revert();
      state.controls?.kill();
    };
    // The explicit dependency list is the same contract as useEffect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      controls.renderAt(frameToSeconds(frame, fps));
    }
  }, [fps, frame]);

  return scopeRef;
};
