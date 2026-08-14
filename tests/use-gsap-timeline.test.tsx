import {Component, StrictMode, act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {gsap} from 'gsap';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const remotionClock = vi.hoisted(() => ({frame: 0, fps: 30}));

vi.mock('remotion', () => ({
  useCurrentFrame: () => remotionClock.frame,
  useVideoConfig: () => ({fps: remotionClock.fps}),
}));

import {useGsapTimeline} from '../src';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

const opacity = (element: Element) => Number.parseFloat((element as HTMLElement).style.opacity);

class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  render() {
    return this.state.failed ? <div data-error-boundary /> : this.props.children;
  }
}

const Harness = ({distance = 1}: {distance?: number}) => {
  const scope = useGsapTimeline<HTMLDivElement>(
    ({timeline, selector}) => {
      timeline.fromTo(
        selector('[data-box]'),
        {opacity: 0},
        {opacity: distance, duration: 1, ease: 'none'},
      );
    },
    {dependencies: [distance]},
  );

  return (
    <div ref={scope}>
      <div data-box style={{opacity: 0.25}} />
    </div>
  );
};

describe('useGsapTimeline', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = async (node: ReactNode) => {
    await act(async () => root.render(node));
  };

  const setFrame = async (frame: number, node: ReactNode) => {
    remotionClock.frame = frame;
    await render(node);
  };

  beforeEach(() => {
    remotionClock.frame = 0;
    remotionClock.fps = 30;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('seeks directly from Remotion frame to GSAP time', async () => {
    await setFrame(15, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.5, 4);
  });

  it('is deterministic while seeking backward and revisiting frames', async () => {
    await setFrame(30, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(1, 4);

    await setFrame(9, <Harness />);
    const firstVisit = opacity(container.querySelector('[data-box]')!);
    expect(firstVisit).toBeCloseTo(0.3, 4);

    await setFrame(24, <Harness />);
    await setFrame(9, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(firstVisit, 6);
  });

  it('rejects callbacks instead of allowing render-time side effects', async () => {
    const onUpdate = vi.fn();
    const CallbackHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
        timeline.to(selector('[data-callback]'), {opacity: 1, onUpdate});
      });

      return (
        <div ref={scope}>
          <div data-callback />
        </div>
      );
    };

    await expect(setFrame(30, <CallbackHarness />)).rejects.toThrow(
      'does not allow timeline callbacks (onUpdate)',
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('rebuilds from explicit dependencies and seeks the replacement timeline', async () => {
    await setFrame(15, <Harness distance={1} />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.5, 4);

    await setFrame(15, <Harness distance={0.6} />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.3, 4);
  });

  it('scopes matching selectors to each hook instance', async () => {
    await setFrame(
      15,
      <>
        <Harness distance={1} />
        <Harness distance={0.4} />
      </>,
    );

    const boxes = container.querySelectorAll('[data-box]');
    expect(opacity(boxes[0]!)).toBeCloseTo(0.5, 4);
    expect(opacity(boxes[1]!)).toBeCloseTo(0.2, 4);
  });

  it('survives Strict Mode setup-cleanup-setup without duplicate playback', async () => {
    await setFrame(
      18,
      <StrictMode>
        <Harness />
      </StrictMode>,
    );

    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.6, 4);
  });

  it('clamps premount frames to the start state', async () => {
    await setFrame(-20, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0, 4);
  });

  it('uses the latest fps without rebuilding the timeline', async () => {
    await setFrame(15, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.5, 4);

    remotionClock.fps = 60;
    await setFrame(15, <Harness />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.25, 4);
  });

  it('holds the final state after the timeline duration', async () => {
    await setFrame(300, <Harness distance={0.8} />);
    expect(opacity(container.querySelector('[data-box]')!)).toBeCloseTo(0.8, 4);
  });

  it('applies zero-duration set operations at frame zero', async () => {
    const SetHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) => {
        timeline.set(selector('[data-set]'), {opacity: 1});
      });

      return (
        <div ref={scope}>
          <div data-set style={{opacity: 0.25}} />
        </div>
      );
    };

    await setFrame(0, <SetHarness />);
    expect(opacity(container.querySelector('[data-set]')!)).toBe(1);
  });

  it('rejects builders that start wall-clock playback', async () => {
    const UnsafeHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => timeline.play());
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <UnsafeHarness />)).rejects.toThrow(
      'builders must not start playback',
    );
  });

  it('rejects playback before play-then-pause can evade the final state check', async () => {
    const UnsafeHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => {
        timeline.play().pause();
      });
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <UnsafeHarness />)).rejects.toThrow(
      'builders must not start playback',
    );

    const UnpausedHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => {
        timeline.paused(false);
      });
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <UnpausedHarness />)).rejects.toThrow(
      'builders must not start playback',
    );
  });

  it('rejects asynchronous builders', async () => {
    const AsyncHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(async () => undefined);
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <AsyncHarness />)).rejects.toThrow('builders must be synchronous');
  });

  it('rejects callback methods before they can execute', async () => {
    const callback = vi.fn();
    const CallHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => timeline.call(callback));
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <CallHarness />)).rejects.toThrow('does not allow timeline.call()');
    expect(callback).not.toHaveBeenCalled();
  });

  it('rejects eventCallback and then callbacks at registration time', async () => {
    const callback = vi.fn();
    const EventCallbackHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => {
        timeline.eventCallback('onComplete', callback);
      });
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <EventCallbackHarness />)).rejects.toThrow(
      'does not allow timeline.eventCallback()',
    );
    expect(callback).not.toHaveBeenCalled();

    const ThenHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline}) => {
        timeline.then(callback);
      });
      return <div ref={scope} />;
    };

    await expect(setFrame(0, <ThenHarness />)).rejects.toThrow(
      'does not allow timeline.then()',
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('allows concise builders that return the chained timeline', async () => {
    const ChainedHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({timeline, selector}) =>
        timeline.fromTo(
          selector('[data-chain]'),
          {opacity: 0},
          {opacity: 1, duration: 1, ease: 'none'},
        ),
      );

      return (
        <div ref={scope}>
          <div data-chain />
        </div>
      );
    };

    await setFrame(15, <ChainedHarness />);
    expect(opacity(container.querySelector('[data-chain]')!)).toBeCloseTo(0.5, 4);
  });

  it('reverts the previous context before rebuilding from dependencies', async () => {
    const RebuildHarness = ({transform}: {transform: boolean}) => {
      const scope = useGsapTimeline<HTMLDivElement>(
        ({timeline, selector}) => {
          if (transform) {
            timeline.set(selector('[data-rebuild]'), {'--offset': '100px'});
          } else {
            timeline.set(selector('[data-rebuild]'), {opacity: 0.5});
          }
        },
        {dependencies: [transform]},
      );

      return (
        <div ref={scope}>
          <div data-rebuild style={{opacity: 0.25}} />
        </div>
      );
    };

    await setFrame(0, <RebuildHarness transform />);
    expect(
      (container.querySelector('[data-rebuild]') as HTMLElement).style.getPropertyValue('--offset'),
    ).toBe('100px');

    await setFrame(0, <RebuildHarness transform={false} />);
    const rebuilt = container.querySelector('[data-rebuild]') as HTMLElement;
    expect(rebuilt.style.getPropertyValue('--offset')).toBe('');
    expect(opacity(rebuilt)).toBe(0.5);
  });

  it('reverts GSAP mutations when a builder throws', async () => {
    let retainedElement: HTMLDivElement | null = null;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const ThrowingHarness = () => {
      const scope = useGsapTimeline<HTMLDivElement>(({selector}) => {
        gsap.set(selector('[data-throw]'), {opacity: 0});
        throw new Error('intentional builder failure');
      });

      return (
        <div ref={scope}>
          <div
            data-throw
            ref={(element) => {
              if (element) retainedElement = element;
            }}
            style={{opacity: 0.25}}
          />
        </div>
      );
    };

    await setFrame(
      0,
      <ErrorBoundary>
        <ThrowingHarness />
      </ErrorBoundary>,
    );

    expect(retainedElement).not.toBeNull();
    expect((retainedElement as HTMLDivElement | null)?.style.opacity).toBe('0.25');
    expect(container.querySelector('[data-error-boundary]')).not.toBeNull();
    consoleError.mockRestore();
  });
});
