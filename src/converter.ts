import { marked } from 'marked';
import { buildEpubBlob, type ChapterData, type NavItem } from './epubBuilder';
import { generateCoverImage } from './cover';

export interface MarkdownToEpubOptions {
  title: string;
  author?: string;
  language?: string;
  coverColor?: string;
  titleColor?: string;
  authorColor?: string;
  titleFontSize?: number;
  includeSubHeadings?: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Split markdown into chapters by top-level H1 lines: exactly "# " at start of line.
 * Each H1 starts a new chapter. Content before the first H1 (if any) is ignored
 * or merged into the first chapter if there is no H1.
 */
function splitIntoChapters(markdown: string): { title: string; bodyMarkdown: string }[] {
  const text = markdown.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const chapters: { title: string; bodyLines: string[] }[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  let preamble: string[] = [];

  const isH1 = (line: string) => /^#\s+/.test(line) && !/^##/.test(line);

  for (const line of lines) {
    if (isH1(line)) {
      // Save previous chapter
      if (currentTitle !== null) {
        chapters.push({ title: currentTitle, bodyLines: currentBody });
      } else if (preamble.length > 0 && currentBody.length === 0) {
        // No previous chapter; preamble will be attached to first chapter body later
      }
      currentTitle = line.replace(/^#\s+/, '').trim() || `Chapter ${chapters.length + 1}`;
      currentBody = [];
    } else {
      if (currentTitle === null) {
        preamble.push(line);
      } else {
        currentBody.push(line);
      }
    }
  }

  // Last chapter
  if (currentTitle !== null) {
    chapters.push({ title: currentTitle, bodyLines: currentBody });
  }

  // No H1 at all → single chapter with whole file
  if (chapters.length === 0) {
    const body = text.trim();
    return [
      {
        title: 'Chapter 1',
        bodyMarkdown: body || '# Chapter 1',
      },
    ];
  }

  // Attach preamble (content before first H1) to the first chapter body
  if (preamble.length > 0) {
    const pre = preamble.join('\n').trim();
    if (pre) {
      chapters[0].bodyLines = [...preamble, '', ...chapters[0].bodyLines];
    }
  }

  return chapters.map((ch, i) => {
    const body = ch.bodyLines.join('\n').trim();
    // Re-include the H1 in the chapter markdown so it appears in content
    const bodyMarkdown = `# ${ch.title}${body ? '\n\n' + body : ''}`;
    return {
      title: ch.title || `Chapter ${i + 1}`,
      bodyMarkdown,
    };
  });
}

/**
 * Inject id attributes on h1 and h2 only.
 * When includeSubHeadings is true, collect H2 entries for the TOC under this chapter.
 */
function processHtmlWithIds(
  html: string,
  chapterIndex: number,
  chapterFileName: string,
  includeSubHeadings: boolean
): { html: string; subNavItems: NavItem[] } {
  const subNavItems: NavItem[] = [];
  let h2Counter = 0;

  const processed = html.replace(
    /<(h[12])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs: string = '', inner: string) => {
      const level = parseInt(tag.charAt(1), 10);
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) return match;

      let id: string;
      if (level === 1) {
        id = `chapter-${chapterIndex + 1}`;
      } else {
        // H2 only
        h2Counter += 1;
        id = `chapter-${chapterIndex + 1}-section-${h2Counter}`;
        if (includeSubHeadings) {
          subNavItems.push({
            label: text,
            href: `${chapterFileName}#${id}`,
          });
        }
      }

      const cleanAttrs = (attrs || '').replace(/\s*id\s*=\s*["'][^"']*["']/gi, '');
      return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
    }
  );

  return { html: processed, subNavItems };
}

const CHAPTER_STYLES = `
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
`;

export async function markdownToEpub(
  markdown: string,
  options: MarkdownToEpubOptions
): Promise<Blob> {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  const lang = options.language || 'en';
  const includeSubHeadings = !!options.includeSubHeadings;

  // Always split by H1 — independent of the sub-headings toggle
  const rawChapters = splitIntoChapters(markdown);

  const chapters: ChapterData[] = [];
  const tocNav: NavItem[] = [];

  for (let i = 0; i < rawChapters.length; i++) {
    const raw = rawChapters[i];
    const fileName = `chapter${i + 1}.xhtml`;

    let html = await marked.parse(raw.bodyMarkdown);

    // XHTML-friendly void elements
    html = html
      .replace(/<br\s*>/gi, '<br/>')
      .replace(/<hr\s*>/gi, '<hr/>')
      .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1/>');

    const { html: processedHtml, subNavItems } = processHtmlWithIds(
      html,
      i,
      fileName,
      includeSubHeadings
    );

    const chapterTitle = raw.title;
    const chapterId = `chapter-${i + 1}`;

    const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(chapterTitle)}</title>
  <style type="text/css">${CHAPTER_STYLES}
  </style>
</head>
<body>
${processedHtml}
</body>
</html>`;

    chapters.push({
      title: chapterTitle,
      fileName,
      content: chapterContent,
      id: chapterId,
    });

    // TOC entry for this chapter; optionally nest ## under it
    tocNav.push({
      label: chapterTitle,
      href: fileName,
      children:
        includeSubHeadings && subNavItems.length > 0 ? subNavItems : undefined,
    });
  }

  const coverImage = await generateCoverImage(
    options.title,
    options.author,
    options.coverColor || '#1a5c3a',
    options.titleColor || '#ffffff',
    options.authorColor || '#ffffff',
    options.titleFontSize || 48
  );

  return buildEpubBlob({
    title: options.title,
    author: options.author,
    language: lang,
    chapters,
    tocNav,
    coverImage,
  });
}
