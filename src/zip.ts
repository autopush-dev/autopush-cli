import archiver from 'archiver';

const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  '.DS_Store',
  '**/.DS_Store',
  'autopush.json',
  '.autopushignore',
];

export interface ZipResult {
  buffer: Buffer;
  fileCount: number;
}

/** Zip the contents of `dir` (paths relative to it) into a Buffer. */
export function zipDir(dir: string, extraIgnore: string[] = []): Promise<ZipResult> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    let fileCount = 0;

    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('entry', (entry) => {
      const stats = (entry as { stats?: { isFile?: () => boolean } }).stats;
      if (stats?.isFile?.()) fileCount += 1;
    });
    archive.on('warning', (err) => {
      if ((err as { code?: string }).code !== 'ENOENT') reject(err);
    });
    archive.on('error', reject);
    archive.on('end', () => resolve({ buffer: Buffer.concat(chunks), fileCount }));

    archive.glob('**/*', {
      cwd: dir,
      dot: true,
      ignore: [...DEFAULT_IGNORE, ...extraIgnore],
    });
    void archive.finalize();
  });
}
