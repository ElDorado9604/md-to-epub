import JSZip from 'jszip';

export interface EpubData {
  title: string;
  author?: string;
  language?: string;
  chapterFileName: string;
  chapterContent: string;
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
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function buildEpubBlob(data: EpubData): Promise<Blob> {
  const zip = new JSZip();
  const uuid = generateUuid();
  const lang = data.language || 'en';
  const title = escapeXml(data.title);
  const author = data.author ? escapeXml(data.author) : undefined;
  const chapterFileName = data.chapterFileName;

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

  // Cover image (if provided)
  const hasCover = !!data.coverImage;
  if (hasCover && data.coverImage) {
    const coverBuffer = await data.coverImage.arrayBuffer();
    zip.file('OEBPS/cover.png', coverBuffer);
  }

  // 3. content.opf (EPUB 3)
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
    <item id="chapter1" href="${chapterFileName}" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
${coverSpine}    <itemref idref="chapter1"/>
  </spine>
</package>`
  );

  // Cover page XHTML (shows the image)
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

  // 4. Navigation document
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
    <ol>
      <li><a href="${chapterFileName}">${title}</a></li>
    </ol>
  </nav>
</body>
</html>`
  );

  // 5. Chapter XHTML
  zip.file(`OEBPS/${chapterFileName}`, data.chapterContent);

  // 6. toc.ncx
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
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel>
        <text>${title}</text>
      </navLabel>
      <content src="${chapterFileName}"/>
    </navPoint>
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
