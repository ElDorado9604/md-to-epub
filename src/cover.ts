/** Generate a simple cover image (PNG) with title and optional author using Canvas */

export async function generateCoverImage(
  title: string,
  author?: string
): Promise<Blob> {
  const width = 800;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background gradient (deep green → darker)
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a5c3a');
  gradient.addColorStop(0.5, '#0f3d28');
  gradient.addColorStop(1, '#0a2819');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle border
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 8;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Inner thin border
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = width - 120;
  const titleFontSize = fitText(ctx, title, maxWidth, 56, 32);
  ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  const titleLines = wrapText(ctx, title, maxWidth);
  const titleBlockHeight = titleLines.length * (titleFontSize * 1.25);
  let y = height * 0.38 - titleBlockHeight / 2;

  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y);
    y += titleFontSize * 1.25;
  }

  // Author
  if (author && author.trim()) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const authorSize = 28;
    ctx.font = `${authorSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const authorY = height * 0.72;
    ctx.fillText(author.trim(), width / 2, authorY);
  }

  // Small decorative line above author
  if (author && author.trim()) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 60, height * 0.72 - 36);
    ctx.lineTo(width / 2 + 60, height * 0.72 - 36);
    ctx.stroke();
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

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth * 1.8) return size; // allow wrapping
    size -= 2;
  }
  return minSize;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  // Limit to 5 lines max
  if (lines.length > 5) {
    return lines.slice(0, 4).concat([lines[4].slice(0, 20) + '…']);
  }
  return lines;
}
