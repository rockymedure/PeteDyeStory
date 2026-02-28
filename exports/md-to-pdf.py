#!/usr/bin/env python3
import sys, os, glob
import markdown
from weasyprint import HTML

CSS = """
@page {
    size: letter;
    margin: 1in 1.1in;
    @bottom-center { content: counter(page); font-size: 9pt; color: #999; }
}
body {
    font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
}
h1 { font-size: 20pt; margin-top: 0; margin-bottom: 6pt; color: #111; }
h2 { font-size: 15pt; margin-top: 24pt; margin-bottom: 8pt; color: #222; border-bottom: 1px solid #ddd; padding-bottom: 4pt; }
h3 { font-size: 12pt; margin-top: 18pt; margin-bottom: 6pt; color: #333; }
h4 { font-size: 11pt; margin-top: 14pt; margin-bottom: 4pt; color: #444; }
p { margin: 6pt 0; }
blockquote {
    border-left: 3px solid #666;
    margin: 10pt 0;
    padding: 4pt 12pt;
    color: #333;
    font-style: italic;
    background: #f8f8f8;
}
table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 9.5pt; }
th { background: #f0f0f0; text-align: left; padding: 6pt 8pt; border: 1px solid #ccc; font-weight: 600; }
td { padding: 5pt 8pt; border: 1px solid #ddd; vertical-align: top; }
tr:nth-child(even) td { background: #fafafa; }
ul, ol { margin: 6pt 0; padding-left: 20pt; }
li { margin: 3pt 0; }
strong { color: #111; }
em { color: #333; }
hr { border: none; border-top: 1px solid #ccc; margin: 18pt 0; }
code { background: #f4f4f4; padding: 1pt 4pt; border-radius: 3pt; font-size: 9.5pt; }
"""

def convert(md_path, pdf_path):
    with open(md_path, 'r') as f:
        md_text = f.read()
    html_body = markdown.markdown(md_text, extensions=['tables', 'fenced_code'])
    html_full = f"<html><head><style>{CSS}</style></head><body>{html_body}</body></html>"
    HTML(string=html_full).write_pdf(pdf_path)
    print(f"  {os.path.basename(md_path)} -> {os.path.basename(pdf_path)}")

if __name__ == '__main__':
    src_dir = sys.argv[1] if len(sys.argv) > 1 else 'edit-revision'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else 'exports/edit-revision'
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src_dir, '*.md')))
    print(f"Converting {len(files)} files to PDF...\n")
    for md_path in files:
        name = os.path.splitext(os.path.basename(md_path))[0]
        pdf_path = os.path.join(out_dir, f"{name}.pdf")
        convert(md_path, pdf_path)
    print(f"\nDone. PDFs in {out_dir}/")
