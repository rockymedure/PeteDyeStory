'use client';

function DownloadLink({
  href,
  label,
  ext,
  target,
}: {
  href: string;
  label: string;
  ext: string;
  target?: string;
}) {
  return (
    <a
      href={href}
      target={target}
      className="group flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-visible)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] transition-colors"
    >
      <span className="font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/20">
        {ext}
      </span>
      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </a>
  );
}

export default function ReviewDownloads() {
  return (
    <div className="flex flex-wrap gap-2">
      <DownloadLink
        href="/api/review/download?format=md"
        label="Markdown"
        ext=".md"
      />
      <DownloadLink
        href="/api/review/download?format=doc"
        label="Word"
        ext=".doc"
      />
      <DownloadLink
        href="/review/print"
        label="PDF"
        ext=".pdf"
        target="_blank"
      />
    </div>
  );
}
