import { readFile } from 'fs/promises';
import { join } from 'path';

export async function readContent(filename: string): Promise<string | null> {
  const base = join(process.cwd(), 'content');

  for (const dir of ['local', 'default']) {
    try {
      return await readFile(join(base, dir, filename), 'utf-8');
    } catch {
      // File not found in this directory, try next
    }
  }

  return null;
}
