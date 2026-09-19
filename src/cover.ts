/** Generate a simple cover image (PNG) with title and optional author using Canvas */

function darken(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  const num = parseInt(
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned,
    16
  );
  if (Number.isNaN(num)) return '#0a0a0a';
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export async function generateCoverImage(
  title: string,
  author?: string,
  baseColor: string = '#1a5c3a',
  titleColor: string = '#ffffff',
  authorColor: string = '#ffffff',
  titleFontSize: number = 48
): Promise<Blob> {
  const width = 800;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const mid = darken(baseColor, 30);
  const dark = darken(baseColor, 55);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(0.5, mid);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Borders
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 8;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // Safe text area (inside inner border)
  const paddingX = 70;
  const maxTextWidth = width - paddingX * 2;

  // Title
  ctx.fillStyle = titleColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size = Math.min(Math.max(titleFontSize, 24), 72);
  const displayTitle = title || 'Untitled';

  // Auto-shrink until text fits in max 6 lines
  let titleLines: string[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    ctx.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    titleLines = wrapText(ctx, displayTitle, maxTextWidth);
    if (titleLines.length <= 6) break;
    size = Math.max(22, size - 3);
  }

  // Final pass at chosen size
  ctx.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  titleLines = wrapText(ctx, displayTitle, maxTextWidth);

  // If a single line is still too wide (very long word), shrink further
  while (
    titleLines.some((line) => ctx.measureText(line).width > maxTextWidth) &&
    size > 18
  ) {
    size -= 2;
    ctx.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    titleLines = wrapText(ctx, displayTitle, maxTextWidth);
  }

  const lineHeight = size * 1.3;
  const titleBlockHeight = titleLines.length * lineHeight;
  // Keep title in the upper-middle area, never overflowing borders
  const maxTitleBottom = height * 0.62;
  let startY = height * 0.36 - titleBlockHeight / 2;
  if (startY + titleBlockHeight > maxTitleBottom) {
    startY = maxTitleBottom - titleBlockHeight;
  }
  if (startY < 80) startY = 80;

  let y = startY;
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y + lineHeight / 2);
    y += lineHeight;
  }

  // Author
  if (author && author.trim()) {
    ctx.fillStyle = authorColor;
    const authorSize = Math.max(18, Math.min(28, Math.round(size * 0.55)));
    ctx.font = `${authorSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;

    const authorText = author.trim();
    // Truncate author if somehow too long
    let authorDisplay = authorText;
    while (
      ctx.measureText(authorDisplay).width > maxTextWidth &&
      authorDisplay.length > 3
    ) {
      authorDisplay = authorDisplay.slice(0, -2) + '…';
    }

    const authorY = Math.min(height * 0.78, height - 100);
    ctx.fillText(authorDisplay, width / 2, authorY);

    // Decorative line
    ctx.strokeStyle = authorColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 50, authorY - authorSize - 12);
    ctx.lineTo(width / 2 + 50, authorY - authorSize - 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate cover image'));
      },
      'image/png',
      0.92
    );
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // Prefer breaking on underscores and hyphens for long technical titles
  const tokens = text.split(/(\s+|_+|-+)/).filter((t) => t.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const test = current + token;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current.trim());
      current = token.trimStart();
    } else {
      current = test;
    }
  }
  if (current.trim()) lines.push(current.trim());

  // Hard-break any remaining overlong line
  const result: string[] = [];
  for (const line of lines) {
    if (ctx.measureText(line).width <= maxWidth) {
      result.push(line);
    } else {
      // Character-level break as last resort
      let chunk = '';
      for (const ch of line) {
        if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
          result.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      if (chunk) result.push(chunk);
    }
  }

  return result.length ? result : [text];
}
