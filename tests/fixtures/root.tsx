import {Composition} from 'remotion';
import {
  FpsFixture,
  NestedSequenceFixture,
  OverlapFixture,
  SamePropertyOverlapFixture,
  SequenceFixture,
  SurfaceFixture,
  SvgRootFixture,
} from './fixtures';
import {GsapShowcase} from './showcase';

export const SHOWCASE_ID = 'GsapShowcase';
export const FPS_30_FIXTURE_ID = 'Fps30Fixture';
export const FPS_60_FIXTURE_ID = 'Fps60Fixture';
export const FPS_24_FIXTURE_ID = 'Fps24Fixture';
export const SEQUENCE_FIXTURE_ID = 'SequenceFixture';
export const NESTED_SEQUENCE_FIXTURE_ID = 'NestedSequenceFixture';
export const SURFACE_FIXTURE_ID = 'SurfaceFixture';
export const OVERLAP_FIXTURE_ID = 'OverlapFixture';
export const SAME_PROPERTY_OVERLAP_FIXTURE_ID = 'SamePropertyOverlapFixture';
export const SVG_ROOT_FIXTURE_ID = 'SvgRootFixture';

export const TestRoot = () => (
  <>
    <Composition
      id={FPS_24_FIXTURE_ID}
      component={FpsFixture}
      durationInFrames={48}
      fps={24}
      width={100}
      height={100}
    />
    <Composition
      id={SHOWCASE_ID}
      component={GsapShowcase}
      durationInFrames={210}
      fps={30}
      width={1280}
      height={720}
    />
    <Composition
      id={FPS_30_FIXTURE_ID}
      component={FpsFixture}
      durationInFrames={60}
      fps={30}
      width={100}
      height={100}
    />
    <Composition
      id={FPS_60_FIXTURE_ID}
      component={FpsFixture}
      durationInFrames={120}
      fps={60}
      width={100}
      height={100}
    />
    <Composition
      id={SEQUENCE_FIXTURE_ID}
      component={SequenceFixture}
      durationInFrames={90}
      fps={30}
      width={100}
      height={100}
    />
    <Composition
      id={NESTED_SEQUENCE_FIXTURE_ID}
      component={NestedSequenceFixture}
      durationInFrames={100}
      fps={30}
      width={100}
      height={100}
    />
    <Composition
      id={SURFACE_FIXTURE_ID}
      component={SurfaceFixture}
      durationInFrames={75}
      fps={30}
      width={320}
      height={180}
    />
    <Composition
      id={OVERLAP_FIXTURE_ID}
      component={OverlapFixture}
      durationInFrames={90}
      fps={30}
      width={320}
      height={180}
    />
    <Composition
      id={SVG_ROOT_FIXTURE_ID}
      component={SvgRootFixture}
      durationInFrames={60}
      fps={30}
      width={100}
      height={100}
    />
    <Composition
      id={SAME_PROPERTY_OVERLAP_FIXTURE_ID}
      component={SamePropertyOverlapFixture}
      durationInFrames={60}
      fps={30}
      width={320}
      height={120}
    />
  </>
);
