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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'section';
}

/** Split markdown into chapters by top-level H1 (# heading) */
function splitIntoChapters(markdown: string): { title: string; markdown: string }[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chapters: { title: string; markdown: string }[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (currentTitle || body) {
      chapters.push({
        title: currentTitle || `Chapter ${chapters.length + 1}`,
        markdown: body ? (currentTitle ? `# ${currentTitle}\n\n${body}` : body) : `# ${currentTitle}`,
      });
    }
  };

  for (const line of lines) {
    if (/^# /.test(line) && !/^## /.test(line)) {
      // New H1 chapter
      if (currentTitle || currentLines.length > 0) {
        flush();
      }
      currentTitle = line.replace(/^#\s+/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  // If no H1 found at all, treat whole file as one chapter
  if (chapters.length === 0) {
    return [{ title: 'Chapter 1', markdown: markdown.trim() || '# Chapter 1' }];
  }
  return chapters;
}

/** Add id attributes to h1/h2/h3 and extract nav structure */
function processHtmlWithIds(
  html: string,
  chapterIndex: number,
  chapterFileName: string,
  includeSubHeadings: boolean
): { html: string; navItems: NavItem[] } {
  const navItems: NavItem[] = [];
  let h2Counter = 0;
  let h3Counter = 0;
  let currentH2: NavItem | null = null;

  // Match opening heading tags and inject ids
  const processed = html.replace(
    /<(h[1-3])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attrs: string = '', inner: string) => {
      const level = parseInt(tag.charAt(1), 10);
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) return _match;

      let id = '';
      if (level === 1) {
        id = `chapter-${chapterIndex + 1}`;
        // H1 is the chapter itself – nav entry is added by caller
      } else if (level === 2) {
        h2Counter += 1;
        h3Counter = 0;
        id = `chapter-${chapterIndex + 1}-h2-${h2Counter}`;
        if (includeSubHeadings) {
          currentH2 = {
            label: text,
            href: `${chapterFileName}#${id}`,
            children: [],
          };
          navItems.push(currentH2);
        }
      } else if (level === 3) {
        h3Counter += 1;
        id = `chapter-${chapterIndex + 1}-h2-${h2Counter || 1}-h3-${h3Counter}`;
        if (includeSubHeadings && currentH2) {
          currentH2.children = currentH2.children || [];
          currentH2.children.push({
            label: text,
            href: `${chapterFileName}#${id}`,
          });
        } else if (includeSubHeadings) {
          // Orphan H3 under chapter
          navItems.push({
            label: text,
            href: `${chapterFileName}#${id}`,
          });
        }
      }

      // Preserve existing attributes, ensure id
      const cleanAttrs = (attrs || '').replace(/\s*id\s*=\s*["'][^"']*["']/i, '');
      return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
    }
  );

  return { html: processed, navItems };
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
  const rawChapters = splitIntoChapters(markdown);

  const chapters: ChapterData[] = [];
  const tocNav: NavItem[] = [];

  for (let i = 0; i < rawChapters.length; i++) {
    const raw = rawChapters[i];
    const fileName = `chapter${i + 1}.xhtml`;
    let html = await marked.parse(raw.markdown);

    // XHTML-friendly cleanup
    html = html
      .replace(/<br>/g, '<br/>')
      .replace(/<hr>/g, '<hr/>')
      .replace(/<img([^>]*)>/g, '<img$1/>');

    const { html: processedHtml, navItems } = processHtmlWithIds(
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

    tocNav.push({
      label: chapterTitle,
      href: fileName,
      children: includeSubHeadings && navItems.length > 0 ? navItems : undefined,
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
