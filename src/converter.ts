import { marked } from 'marked';
import { buildEpubBlob } from './epubBuilder';

export interface MarkdownToEpubOptions {
  title: string;
  author?: string;
  language?: string;
}

export async function markdownToEpub(
  markdown: string,
  options: MarkdownToEpubOptions
): Promise<Blob> {
  const html = await marked.parse(markdown);

  const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${options.language || 'en'}" lang="${options.language || 'en'}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(options.title)}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 1em; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.2em; margin-bottom: 0.4em; }
    p { margin: 0.6em 0; }
    pre, code { font-family: monospace; }
    pre { background: #f4f4f4; padding: 0.8em; overflow-x: auto; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  return buildEpubBlob({
    title: options.title,
    author: options.author,
    language: options.language || 'en',
    chapterFileName: 'chapter1.xhtml',
    chapterContent,
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
