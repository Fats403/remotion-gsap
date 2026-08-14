import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {
  openBrowser,
  renderFrames,
  renderStill,
  selectComposition,
  type HeadlessBrowser,
} from '@remotion/renderer';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  FPS_30_FIXTURE_ID,
  FPS_24_FIXTURE_ID,
  FPS_60_FIXTURE_ID,
  NESTED_SEQUENCE_FIXTURE_ID,
  OVERLAP_FIXTURE_ID,
  SEQUENCE_FIXTURE_ID,
  SHOWCASE_ID,
  SURFACE_FIXTURE_ID,
  SVG_ROOT_FIXTURE_ID,
} from './fixtures/root';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPoint = path.join(rootDir, 'tests/fixtures/index.ts');
const shuffledFrames = [105, 0, 195, 45, 150, 15, 75];

const pixelDifference = (leftBuffer: Buffer, rightBuffer: Buffer) => {
  const left = PNG.sync.read(leftBuffer);
  const right = PNG.sync.read(rightBuffer);

  expect(right.width).toBe(left.width);
  expect(right.height).toBe(left.height);

  return pixelmatch(left.data, right.data, undefined, left.width, left.height, {threshold: 0});
};

const pixelAt = (buffer: Buffer, x: number, y: number) => {
  const png = PNG.sync.read(buffer);
  const offset = (y * png.width + x) * 4;
  return [...png.data.subarray(offset, offset + 4)];
};

describe('Remotion renderer parity', () => {
  let serveUrl: string;
  let composition: Awaited<ReturnType<typeof selectComposition>>;
  let browser: HeadlessBrowser;

  beforeAll(async () => {
    serveUrl = await bundle({entryPoint});
    composition = await selectComposition({serveUrl, id: SHOWCASE_ID});
    browser = await openBrowser('chrome', {logLevel: 'warn'});
  });

  afterAll(async () => {
    await browser?.close({silent: false});
  });

  const renderFrameMap = async (
    targetComposition: Awaited<ReturnType<typeof selectComposition>>,
    concurrency: number,
  ) => {
    const frames = new Map<number, Buffer>();

    await renderFrames({
      serveUrl,
      composition: targetComposition,
      inputProps: {},
      outputDir: null,
      imageFormat: 'png',
      frameRange: [0, targetComposition.durationInFrames - 1],
      everyNthFrame: 1,
      concurrency,
      puppeteerInstance: browser,
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
      onFrameBuffer: (buffer, frame) => frames.set(frame, buffer),
      logLevel: 'warn',
    });

    return frames;
  };

  it('matches concurrent sequence rendering with shuffled direct-frame rendering', async () => {
    const sequenceFrames = new Map<number, Buffer>();

    await renderFrames({
      serveUrl,
      composition,
      inputProps: {},
      outputDir: null,
      imageFormat: 'png',
      frameRange: [0, composition.durationInFrames - 1],
      everyNthFrame: 15,
      concurrency: 4,
      puppeteerInstance: browser,
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
      onFrameBuffer: (buffer, frame) => {
        sequenceFrames.set(frame, buffer);
      },
      logLevel: 'warn',
    });

    for (const frame of shuffledFrames) {
      const direct = await renderStill({
        serveUrl,
        composition,
        frame,
        output: null,
        imageFormat: 'png',
        puppeteerInstance: browser,
        logLevel: 'warn',
      });

      const fromSequence = sequenceFrames.get(frame);
      expect(fromSequence, `sequence buffer for frame ${frame}`).toBeDefined();
      expect(direct.buffer, `direct buffer for frame ${frame}`).not.toBeNull();
      const difference = pixelDifference(fromSequence!, direct.buffer!);
      expect(
        difference,
        `showcase frame ${frame}`,
      ).toBe(0);
    }
  });

  it('repeated direct renders of the same frame are pixel-identical', async () => {
    const first = await renderStill({
      serveUrl,
      composition,
      frame: 87,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const second = await renderStill({
      serveUrl,
      composition,
      frame: 87,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });

    expect(pixelDifference(first.buffer!, second.buffer!)).toBe(0);
  });

  it('maps equal local time to equal pixels at 30fps, 60fps, and inside a Sequence', async () => {
    const fps24 = await selectComposition({serveUrl, id: FPS_24_FIXTURE_ID});
    const fps30 = await selectComposition({serveUrl, id: FPS_30_FIXTURE_ID});
    const fps60 = await selectComposition({serveUrl, id: FPS_60_FIXTURE_ID});
    const sequence = await selectComposition({serveUrl, id: SEQUENCE_FIXTURE_ID});
    const nestedSequence = await selectComposition({
      serveUrl,
      id: NESTED_SEQUENCE_FIXTURE_ID,
    });

    const halfSecond24 = await renderStill({
      serveUrl,
      composition: fps24,
      frame: 12,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const halfSecond30 = await renderStill({
      serveUrl,
      composition: fps30,
      frame: 15,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const halfSecond60 = await renderStill({
      serveUrl,
      composition: fps60,
      frame: 30,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const halfSecondInSequence = await renderStill({
      serveUrl,
      composition: sequence,
      frame: 45,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const halfSecondInNestedSequence = await renderStill({
      serveUrl,
      composition: nestedSequence,
      frame: 45,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });

    expect(pixelDifference(halfSecond24.buffer!, halfSecond30.buffer!)).toBe(0);
    expect(pixelDifference(halfSecond30.buffer!, halfSecond60.buffer!)).toBe(0);
    expect(pixelDifference(halfSecond30.buffer!, halfSecondInSequence.buffer!)).toBe(0);
    expect(pixelDifference(halfSecond30.buffer!, halfSecondInNestedSequence.buffer!)).toBe(0);
  });

  it('renders exact start, midpoint, and post-duration states', async () => {
    const fps30 = await selectComposition({serveUrl, id: FPS_30_FIXTURE_ID});
    const frames = await Promise.all(
      [0, 15, 59].map(async (frame) =>
        renderStill({
          serveUrl,
          composition: fps30,
          frame,
          output: null,
          puppeteerInstance: browser,
          imageFormat: 'png',
          logLevel: 'warn',
        }),
      ),
    );

    expect(pixelAt(frames[0]!.buffer!, 50, 50)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(frames[1]!.buffer!, 50, 50)).toEqual([128, 0, 0, 255]);
    expect(pixelAt(frames[2]!.buffer!, 50, 50)).toEqual([255, 0, 0, 255]);
  });

  it('matches every complex-surface frame at concurrency 1 and 8', async () => {
    const surface = await selectComposition({serveUrl, id: SURFACE_FIXTURE_ID});
    const serial = await renderFrameMap(surface, 1);
    const concurrent = await renderFrameMap(surface, 8);

    expect(serial.size).toBe(surface.durationInFrames);
    expect(concurrent.size).toBe(surface.durationInFrames);

    for (let frame = 0; frame < surface.durationInFrames; frame++) {
      expect(
        pixelDifference(serial.get(frame)!, concurrent.get(frame)!),
        `surface frame ${frame}`,
      ).toBe(0);
    }
  });

  it('keeps overlapping scoped Sequences deterministic under shuffled access', async () => {
    const overlap = await selectComposition({serveUrl, id: OVERLAP_FIXTURE_ID});
    const rendered = await renderFrameMap(overlap, 8);

    for (const frame of [84, 30, 9, 64, 10, 45, 29]) {
      const direct = await renderStill({
        serveUrl,
        composition: overlap,
        frame,
        output: null,
        puppeteerInstance: browser,
        imageFormat: 'png',
        logLevel: 'warn',
      });

      expect(pixelDifference(rendered.get(frame)!, direct.buffer!)).toBe(0);
    }
  });

  it('supports an SVG element as the timeline scope root', async () => {
    const svg = await selectComposition({serveUrl, id: SVG_ROOT_FIXTURE_ID});
    const direct = await renderStill({
      serveUrl,
      composition: svg,
      frame: 15,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });
    const repeated = await renderStill({
      serveUrl,
      composition: svg,
      frame: 15,
      output: null,
      puppeteerInstance: browser,
      imageFormat: 'png',
      logLevel: 'warn',
    });

    expect(pixelDifference(direct.buffer!, repeated.buffer!)).toBe(0);
  });
});
