import {execFile} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(rootDir, '.consumer-'));
const consumerDir = path.join(temporaryRoot, 'consumer');
const installedPackageDir = path.join(consumerDir, 'node_modules', 'remotion-gsap');

try {
  await mkdir(installedPackageDir, {recursive: true});
  await exec('pnpm', ['pack', '--pack-destination', temporaryRoot], {cwd: rootDir});

  const tarballName = (await readdir(temporaryRoot)).find((name) => name.endsWith('.tgz'));
  if (!tarballName) {
    throw new Error('pnpm pack did not produce a tarball');
  }

  await exec(
    'tar',
    ['-xzf', path.join(temporaryRoot, tarballName), '-C', installedPackageDir, '--strip-components=1'],
    {cwd: rootDir},
  );

  await access(path.join(installedPackageDir, 'dist', 'index.js'));
  await access(path.join(installedPackageDir, 'dist', 'index.cjs'));
  await access(path.join(installedPackageDir, 'dist', 'index.d.ts'));
  await access(path.join(installedPackageDir, 'SKILL.md'));

  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({name: 'remotion-gsap-consumer-fixture', private: true, type: 'module'}, null, 2),
  );
  await writeFile(
    path.join(consumerDir, 'runtime.mjs'),
    `import {frameToSeconds, useGsapTimeline} from 'remotion-gsap';

if (frameToSeconds(45, 30) !== 1.5) throw new Error('frameToSeconds export failed');
if (typeof useGsapTimeline !== 'function') throw new Error('useGsapTimeline export failed');
console.log('runtime exports ok');
`,
  );
  await writeFile(
    path.join(consumerDir, 'consumer.tsx'),
    `import type {GsapTimelineBuilder} from 'remotion-gsap';
import {frameToSeconds, useGsapTimeline} from 'remotion-gsap';

const svgBuilder: GsapTimelineBuilder<SVGSVGElement> = ({timeline, selector}) =>
  timeline.to(selector('[data-dot]'), {x: 20});

export const Consumer = () => {
  const scope = useGsapTimeline<SVGSVGElement>(svgBuilder);
  return <svg ref={scope}><circle data-dot /></svg>;
};

export const seconds: number = frameToSeconds(30, 30);
`,
  );
  await writeFile(
    path.join(consumerDir, 'runtime.cjs'),
    `const {frameToSeconds, useGsapTimeline} = require('remotion-gsap');

if (frameToSeconds(45, 30) !== 1.5) throw new Error('CommonJS frameToSeconds export failed');
if (typeof useGsapTimeline !== 'function') throw new Error('CommonJS useGsapTimeline export failed');
console.log('CommonJS runtime exports ok');
`,
  );
  await writeFile(
    path.join(consumerDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['consumer.tsx'],
      },
      null,
      2,
    ),
  );

  await exec('node', ['runtime.mjs'], {cwd: consumerDir});
  await exec('node', ['runtime.cjs'], {cwd: consumerDir});
  await exec(path.join(rootDir, 'node_modules', '.bin', 'tsc'), ['--project', 'tsconfig.json'], {
    cwd: consumerDir,
  });

  const skill = await readFile(
    path.join(installedPackageDir, 'SKILL.md'),
    'utf8',
  );
  if (!skill.includes('name: remotion-gsap')) {
    throw new Error('packed skill metadata is invalid');
  }

  console.log('Packed consumer runtime, types, exports, and skill: ok');
} finally {
  await rm(temporaryRoot, {recursive: true, force: true});
}
