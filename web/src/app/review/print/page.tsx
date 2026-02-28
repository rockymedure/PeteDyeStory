'use client';

import { useEffect, useState } from 'react';

export default function ReviewPrintPage() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    fetch('/api/review/download?format=doc')
      .then((r) => r.text())
      .then((docHtml) => {
        const bodyMatch = docHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        setHtml(bodyMatch?.[1] ?? docHtml);
      })
      .then(() => {
        setTimeout(() => window.print(), 400);
      });
  }, []);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { background: white !important; color: #1a1a1a !important; }
        .scanlines, .grain { display: none !important; }
      `}</style>
      <main
        className="max-w-[7.5in] mx-auto py-8 px-4 font-serif text-[11pt] leading-[1.6] text-black bg-white"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        <style>{`
          .print-body h1 { font-size: 22pt; font-weight: bold; margin-top: 0; margin-bottom: 12pt; color: #111; }
          .print-body h2 { font-size: 16pt; font-weight: bold; margin-top: 24pt; margin-bottom: 8pt; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .print-body h3 { font-size: 13pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; color: #333; }
          .print-body h4 { font-size: 11pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; }
          .print-body p { margin: 6pt 0; }
          .print-body ul, .print-body ol { margin: 6pt 0; padding-left: 24pt; }
          .print-body li { margin: 3pt 0; }
          .print-body table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
          .print-body th { background: #f0f0f0; font-weight: bold; text-align: left; padding: 6pt 8pt; border: 1px solid #ccc; }
          .print-body td { padding: 5pt 8pt; border: 1px solid #ddd; vertical-align: top; }
          .print-body hr { border: none; border-top: 1px solid #ccc; margin: 18pt 0; }
          .print-body strong { font-weight: bold; }
          .print-body em { font-style: italic; }
          .print-body code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 1px 3px; }
          .print-body blockquote { border-left: 3px solid #ccc; margin: 12pt 0; padding-left: 12pt; color: #555; font-style: italic; }
        `}</style>
        {html ? (
          <div className="print-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="text-gray-400 text-center py-20">Preparing document...</p>
        )}
      </main>
    </>
  );
}
