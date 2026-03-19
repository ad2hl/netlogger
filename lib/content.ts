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

export async function readContentWithType(
  basename: string
): Promise<{ content: string; type: 'html' | 'md' } | null> {
  const base = join(process.cwd(), 'content');

  for (const dir of ['local', 'default']) {
    for (const type of ['html', 'md'] as const) {
      try {
        const content = await readFile(join(base, dir, `${basename}.${type}`), 'utf-8');
        return { content, type };
      } catch {
        // File not found, try next
      }
    }
  }

  return null;
}
