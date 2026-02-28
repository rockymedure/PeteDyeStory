import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const REVIEW_PATH = path.join(process.cwd(), 'src', 'content', 'rough-cut-review.md');
const FILENAME_BASE = 'Heaven-in-the-Hills-Editorial-Review';

async function getMarkdown() {
  return readFile(REVIEW_PATH, 'utf8');
}

function wrapInWordHtml(html: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${FILENAME_BASE}</title>
<style>
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; max-width: 7.5in; margin: 0 auto; padding: 0.5in; }
  h1 { font-size: 22pt; font-weight: bold; margin-top: 0; margin-bottom: 12pt; color: #111; }
  h2 { font-size: 16pt; font-weight: bold; margin-top: 24pt; margin-bottom: 8pt; color: #222; border-bottom: 1pt solid #ccc; padding-bottom: 4pt; }
  h3 { font-size: 13pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; color: #333; }
  h4 { font-size: 11pt; font-weight: bold; margin-top: 14pt; margin-bottom: 4pt; }
  p { margin: 6pt 0; }
  ul, ol { margin: 6pt 0; padding-left: 24pt; }
  li { margin: 3pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
  th { background: #f0f0f0; font-weight: bold; text-align: left; padding: 6pt 8pt; border: 1pt solid #ccc; }
  td { padding: 5pt 8pt; border: 1pt solid #ddd; vertical-align: top; }
  hr { border: none; border-top: 1pt solid #ccc; margin: 18pt 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 1pt 3pt; }
  blockquote { border-left: 3pt solid #ccc; margin: 12pt 0; padding-left: 12pt; color: #555; font-style: italic; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format');

  if (!format || !['md', 'doc'].includes(format)) {
    return NextResponse.json({ error: 'format must be md or doc' }, { status: 400 });
  }

  const markdown = await getMarkdown();

  if (format === 'md') {
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${FILENAME_BASE}.md"`,
      },
    });
  }

  const html = await marked(markdown, { gfm: true });
  const docHtml = wrapInWordHtml(html);

  return new NextResponse(docHtml, {
    headers: {
      'Content-Type': 'application/msword',
      'Content-Disposition': `attachment; filename="${FILENAME_BASE}.doc"`,
    },
  });
}
