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
  // Configure marked for cleaner output
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  const rawHtml = await marked.parse(markdown);

  // Basic cleanup to make the HTML more XHTML-friendly
  const html = rawHtml
    .replace(/<br>/g, '<br/>')
    .replace(/<hr>/g, '<hr/>')
    .replace(/<img([^>]*)>/g, '<img$1/>');

  const lang = options.language || 'en';
  const title = escapeXml(options.title);

  const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style type="text/css">
    body {
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.6;
      margin: 1em;
      color: #111;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: system-ui, -apple-system, sans-serif;
      margin-top: 1.4em;
      margin-bottom: 0.5em;
      line-height: 1.25;
    }
    h1 { font-size: 1.6em; }
    h2 { font-size: 1.35em; }
    h3 { font-size: 1.15em; }
    p { margin: 0.7em 0; }
    pre, code {
      font-family: "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 0.9em;
      overflow-x: auto;
      border-radius: 4px;
    }
    code {
      background: #f0f0f0;
      padding: 0.15em 0.35em;
      border-radius: 3px;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    blockquote {
      margin: 1em 0;
      padding-left: 1em;
      border-left: 3px solid #ccc;
      color: #444;
    }
    ul, ol { margin: 0.7em 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    img { max-width: 100%; height: auto; }
    a { color: #2563eb; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.5em;
      text-align: left;
    }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  return buildEpubBlob({
    title: options.title,
    author: options.author,
    language: lang,
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
