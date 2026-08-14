import {execFile} from 'node:child_process';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'remotion-gsap-react18-'));

try {
  await exec('pnpm', ['pack', '--pack-destination', temporaryRoot], {cwd: rootDir});
  const tarballName = (await readdir(temporaryRoot)).find((name) => name.endsWith('.tgz'));
  if (!tarballName) throw new Error('pnpm pack did not produce a tarball');

  const packageJson = {
    name: 'remotion-gsap-react-18-fixture',
    private: true,
    type: 'module',
    dependencies: {
      gsap: '3.15.0',
      react: '18.3.1',
      'react-dom': '18.3.1',
      remotion: '4.0.501',
      'remotion-gsap': `file:${path.join(temporaryRoot, tarballName)}`,
    },
    devDependencies: {
      '@types/react': '18.3.28',
      '@types/react-dom': '18.3.7',
      typescript: '5.9.3',
    },
  };

  await writeFile(path.join(temporaryRoot, 'package.json'), JSON.stringify(packageJson, null, 2));
  await writeFile(
    path.join(temporaryRoot, 'consumer.tsx'),
    `import {useGsapTimeline} from 'remotion-gsap';

export const React18Consumer = () => {
  const scope = useGsapTimeline<SVGSVGElement>(({timeline, selector}) =>
    timeline.to(selector('[data-dot]'), {x: 24}),
  );
  return <svg ref={scope}><circle data-dot /></svg>;
};
`,
  );
  await writeFile(
    path.join(temporaryRoot, 'tsconfig.json'),
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

  await exec('pnpm', ['install', '--ignore-scripts'], {cwd: temporaryRoot});
  await exec('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], {cwd: temporaryRoot});

  const installedManifest = JSON.parse(
    await readFile(path.join(temporaryRoot, 'node_modules', 'react', 'package.json'), 'utf8'),
  ) as {version: string};
  if (installedManifest.version !== '18.3.1') {
    throw new Error(`Expected React 18.3.1, received ${installedManifest.version}`);
  }

  console.log('Packed package types compile with React 18.3.1: ok');
} finally {
  await rm(temporaryRoot, {recursive: true, force: true});
}
