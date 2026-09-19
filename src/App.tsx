import { useState, useRef, useEffect } from 'react';
import { markdownToEpub } from './converter';
import { generateCoverImage } from './cover';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverColor, setCoverColor] = useState('#1a5c3a');
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [authorColor, setAuthorColor] = useState('#ffffff');
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [includeSubHeadings, setIncludeSubHeadings] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('book.epub');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setDownloadUrl(null);
    setError(null);
    if (selected && !title) {
      const name = selected.name.replace(/\.md$/i, '');
      setTitle(name);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setShowPreview(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = await generateCoverImage(
        title.trim() || 'Untitled',
        author.trim() || undefined,
        coverColor,
        titleColor,
        authorColor,
        titleFontSize
      );
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      setError('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!showPreview) return;
    const t = setTimeout(() => {
      handlePreview();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author, coverColor, titleColor, authorColor, titleFontSize]);

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const markdown = await file.text();
      const bookTitle =
        title.trim() || file.name.replace(/\.md$/i, '') || 'Untitled';
      const blob = await markdownToEpub(markdown, {
        title: bookTitle,
        author: author.trim() || undefined,
        language: 'en',
        coverColor,
        titleColor,
        authorColor,
        titleFontSize,
        includeSubHeadings,
      });

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(
        `${bookTitle.replace(/[^\w\s-]/g, '').trim() || 'book'}.epub`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    boxSizing: 'border-box',
  };

  const colorRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  };

  const ColorSwatch = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <label
      style={{
        position: 'relative',
        width: 40,
        height: 32,
        borderRadius: 6,
        border: '2px solid #ccc',
        overflow: 'hidden',
        cursor: 'pointer',
        background: value,
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          border: 'none',
          padding: 0,
        }}
      />
    </label>
  );

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 480,
        margin: '40px auto',
        padding: '0 16px 40px',
        color: '#1a1a1a',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24 }}>
        Markdown → EPUB
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Markdown file</label>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleFileChange}
          style={{ fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Book title"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Author (optional)</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name"
          style={inputStyle}
        />
      </div>

      {/* Chapters hint + sub-headings toggle */}
      <div
        style={{
          marginBottom: 16,
          padding: '12px 14px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
          Chapters are created from <code style={{ fontSize: 12 }}># Heading</code> lines.
          Sub-headings (<code style={{ fontSize: 12 }}>##</code> only) can be added to the table of contents using the toggle.
        </p>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={includeSubHeadings}
            onChange={(e) => setIncludeSubHeadings(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Include sub-headings (##) in navigation
        </label>
      </div>

      {/* Colors */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ ...labelStyle, marginBottom: 10 }}>Colors</label>

        <div style={colorRowStyle}>
          <ColorSwatch value={coverColor} onChange={setCoverColor} />
          <span style={{ fontSize: 14 }}>Cover background</span>
        </div>

        <div style={colorRowStyle}>
          <ColorSwatch value={titleColor} onChange={setTitleColor} />
          <span style={{ fontSize: 14 }}>Title text</span>
        </div>

        <div style={colorRowStyle}>
          <ColorSwatch value={authorColor} onChange={setAuthorColor} />
          <span style={{ fontSize: 14 }}>Author text</span>
        </div>
      </div>

      {/* Font size */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>
          Title font size: {titleFontSize}px
        </label>
        <input
          type="range"
          min={28}
          max={72}
          step={2}
          value={titleFontSize}
          onChange={(e) => setTitleFontSize(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Preview button */}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={handlePreview}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            background: '#f3f4f6',
            color: '#1a1a1a',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Preview cover
        </button>
      </div>

      <button
        onClick={handleConvert}
        disabled={!file || converting}
        style={{
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 500,
          background: !file || converting ? '#ccc' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: !file || converting ? 'not-allowed' : 'pointer',
        }}
      >
        {converting ? 'Converting…' : 'Convert to EPUB'}
      </button>

      {error && (
        <p style={{ color: '#dc2626', marginTop: 16, fontSize: 14 }}>{error}</p>
      )}

      {downloadUrl && (
        <p style={{ marginTop: 20 }}>
          <a
            href={downloadUrl}
            download={downloadName}
            style={{
              color: '#2563eb',
              fontWeight: 500,
              fontSize: 15,
            }}
          >
            Download EPUB
          </a>
        </p>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              maxWidth: 340,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <strong style={{ fontSize: 15 }}>Cover preview</strong>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 20,
                  cursor: 'pointer',
                  lineHeight: 1,
                  color: '#666',
                }}
              >
                ×
              </button>
            </div>
            {previewLoading && (
              <p style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>
                Generating…
              </p>
            )}
            {previewUrl && !previewLoading && (
              <img
                src={previewUrl}
                alt="Cover preview"
                style={{
                  width: '100%',
                  borderRadius: 6,
                  display: 'block',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
