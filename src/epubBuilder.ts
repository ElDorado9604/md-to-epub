import JSZip from 'jszip';

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface ChapterData {
  title: string;
  fileName: string;
  content: string;
  id: string;
}

export interface EpubData {
  title: string;
  author?: string;
  language?: string;
  chapters: ChapterData[];
  tocNav: NavItem[];
  coverImage?: Blob;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function renderNavList(items: NavItem[]): string {
  if (!items.length) return '';
  const lis = items
    .map((item) => {
      const children =
        item.children && item.children.length > 0
          ? `\n${renderNavList(item.children)}`
          : '';
      return `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a>${children}</li>`;
    })
    .join('\n');
  return `    <ol>\n${lis}\n    </ol>`;
}

export async function buildEpubBlob(data: EpubData): Promise<Blob> {
  const zip = new JSZip();
  const uuid = generateUuid();
  const lang = data.language || 'en';
  const title = escapeXml(data.title);
  const author = data.author ? escapeXml(data.author) : undefined;
  const chapters = data.chapters;

  // 1. mimetype MUST be first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // Cover image
  const hasCover = !!data.coverImage;
  if (hasCover && data.coverImage) {
    const coverBuffer = await data.coverImage.arrayBuffer();
    zip.file('OEBPS/cover.png', coverBuffer);
  }

  // Manifest + spine for chapters
  const chapterManifest = chapters
    .map(
      (ch, i) =>
        `    <item id="chapter${i + 1}" href="${ch.fileName}" media-type="application/xhtml+xml"/>`
    )
    .join('\n');

  const chapterSpine = chapters
    .map((_ch, i) => `    <itemref idref="chapter${i + 1}"/>`)
    .join('\n');

  const creatorMeta = author
    ? `    <dc:creator id="creator">${author}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
`
    : '';

  const coverMeta = hasCover
    ? `    <meta name="cover" content="cover-image"/>
`
    : '';

  const coverManifest = hasCover
    ? `    <item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
`
    : '';

  const coverSpine = hasCover ? `    <itemref idref="cover" linear="yes"/>
` : '';

  // 3. content.opf
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf"
         unique-identifier="BookId"
         version="3.0"
         xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>${lang}</dc:language>
${creatorMeta}${coverMeta}    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
${coverManifest}    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${chapterManifest}
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
${coverSpine}${chapterSpine}
  </spine>
</package>`
  );

  // Cover page
  if (hasCover) {
    zip.file(
      'OEBPS/cover.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>Cover</title>
  <style type="text/css">
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <img src="cover.png" alt="${title}"/>
</body>
</html>`
    );
  }

  // 4. nav.xhtml (EPUB 3 navigation)
  const navList = renderNavList(data.tocNav);
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
${navList}
  </nav>
</body>
</html>`
  );

  // 5. Chapter XHTML files
  for (const ch of chapters) {
    zip.file(`OEBPS/${ch.fileName}`, ch.content);
  }

  // 6. toc.ncx (top-level chapters only for simplicity)
  const ncxPoints = chapters
    .map(
      (ch, i) => `    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>${escapeXml(ch.title)}</text>
      </navLabel>
      <content src="${ch.fileName}"/>
    </navPoint>`
    )
    .join('\n');

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${title}</text>
  </docTitle>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return blob;
}
