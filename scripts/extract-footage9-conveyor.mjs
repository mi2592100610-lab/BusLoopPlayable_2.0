import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFootageConveyor } from './extract-footage8-conveyor.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'artifacts/footage9-source');
const archive = process.argv[2] ?? 'C:/Users/lumina/Desktop/footage9.unitypackage';
await mkdir(source, { recursive: true });
const entries = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
const assets = [];
const names = new Set();
for (const entry of entries.filter((name) => /^[a-f0-9]{32}\/pathname$/.test(name))) {
  const guid = entry.split('/')[0];
  const unityPath = execFileSync('tar', ['-xOf', archive, entry], { encoding: 'utf8' }).trim();
  const name = path.posix.basename(unityPath);
  if (!name || names.has(name)) throw new Error(`Duplicate or empty asset name: ${name}`);
  names.add(name);
  const data = execFileSync('tar', ['-xOf', archive, `${guid}/asset`], { maxBuffer: 64 * 1024 * 1024 });
  const meta = execFileSync('tar', ['-xOf', archive, `${guid}/asset.meta`]);
  if (!meta.toString().includes(`guid: ${guid}`)) throw new Error(`GUID mismatch: ${name}`);
  await writeFile(path.join(source, name), data);
  await writeFile(path.join(source, `${name}.meta`), meta);
  assets.push({ guid, unityPath, file: name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await writeFile(path.join(source, 'source-manifest.json'), JSON.stringify({
  archive, archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'), assets
}, null, 2));
// Same verified base Paths GUID as Footage8; copy the required Unity dependency.
await mkdir(path.join(source, 'dependencies'), { recursive: true });
for (const name of ['Paths.prefab', 'Paths.prefab.meta']) {
  await copyFile(path.join(root, 'artifacts/footage8-source/dependencies', name), path.join(source, 'dependencies', name));
}
console.log(JSON.stringify(assets, null, 2));
await generateFootageConveyor({ footage: 9, modelSpecs: [
  { file: 'Loop_footage9.FBX', guid: 'c8b6afa9b5bdd0d489aa6b44909d2b1a', texture: 'Loop_footage.png', shadow: false },
  { file: 'Loop_footage_shadow.FBX', guid: 'aa77b2de5e537b94298a7f935c7455f3', texture: 'Loop_footage9_shadow.png', shadow: true }
] });
