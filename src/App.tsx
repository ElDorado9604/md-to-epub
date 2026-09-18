import { useState, useRef } from 'react';
import { markdownToEpub } from './converter';

const COVER_PRESETS = [
  { name: 'Green', value: '#1a5c3a' },
  { name: 'Blue', value: '#1e3a5f' },
  { name: 'Purple', value: '#4a1d6a' },
  { name: 'Red', value: '#6b1e1e' },
  { name: 'Teal', value: '#0d4f4f' },
  { name: 'Slate', value: '#2d3748' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverColor, setCoverColor] = useState('#1a5c3a');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('book.epub');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 480,
        margin: '40px auto',
        padding: '0 16px',
        color: '#1a1a1a',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24 }}>
        Markdown → EPUB
      </h1>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Markdown file
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleFileChange}
          style={{ fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Title (optional)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Book title"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Author (optional)
        </label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Cover color
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {COVER_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              onClick={() => setCoverColor(preset.value)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: preset.value,
                border:
                  coverColor === preset.value
                    ? '3px solid #2563eb'
                    : '2px solid #ddd',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: '#555',
            }}
          >
            Custom
            <input
              type="color"
              value={coverColor}
              onChange={(e) => setCoverColor(e.target.value)}
              style={{
                width: 36,
                height: 36,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </label>
        </div>
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
    </div>
  );
}
