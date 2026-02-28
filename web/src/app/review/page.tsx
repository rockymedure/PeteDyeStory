import AppHeader from '@/components/AppHeader';
import ReviewDownloads from '@/components/ReviewDownloads';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function getReviewMarkdown() {
  const reviewPath = path.join(process.cwd(), 'src', 'content', 'rough-cut-review.md');
  return readFile(reviewPath, 'utf8');
}

export default async function ReviewPage() {
  const reviewMd = await getReviewMarkdown();

  return (
    <main className="min-h-screen relative">
      <AppHeader />

      <section className="pt-32 pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--rec-red)] uppercase mb-6">
              For Seth
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 leading-[1.1]">
              Revision Map
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Scene-by-scene guide from the rough cut to the film we&apos;re making.
              What to keep, what to move, what to add.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase border border-[var(--rec-red)]/25 text-[var(--rec-red)] bg-[var(--rec-red)]/10">
                11 scenes
              </span>
              <span className="px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase border border-[var(--amber)]/25 text-[var(--amber)] bg-[var(--amber)]/10">
                8 changes
              </span>
              <span className="px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase border border-[var(--border-visible)] text-[var(--text-muted)]">
                Feb 28, 2026
              </span>
            </div>

            <div className="mt-6">
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase mb-3">
                Download
              </p>
              <ReviewDownloads />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <article className="card p-6 md:p-10 overflow-hidden">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => (
                  <h2
                    className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-4"
                    {...props}
                  />
                ),
                h2: (props) => (
                  <h3
                    className="text-xl md:text-2xl font-semibold text-[var(--text-primary)] mt-10 mb-4"
                    {...props}
                  />
                ),
                h3: (props) => (
                  <h4
                    className="text-lg md:text-xl font-semibold text-[var(--amber)] mt-8 mb-3"
                    {...props}
                  />
                ),
                h4: (props) => (
                  <h5
                    className="text-base font-semibold text-[var(--text-primary)] mt-6 mb-2"
                    {...props}
                  />
                ),
                p: (props) => (
                  <p
                    className="text-[var(--text-secondary)] leading-relaxed my-3"
                    {...props}
                  />
                ),
                ul: (props) => (
                  <ul
                    className="my-3 pl-5 space-y-2 list-disc text-[var(--text-secondary)]"
                    {...props}
                  />
                ),
                ol: (props) => (
                  <ol
                    className="my-3 pl-5 space-y-2 list-decimal text-[var(--text-secondary)]"
                    {...props}
                  />
                ),
                li: (props) => <li className="leading-relaxed" {...props} />,
                hr: () => <div className="my-10 h-px bg-[var(--border-subtle)]" />,
                blockquote: (props) => (
                  <blockquote
                    className="border-l-2 border-[var(--amber)]/40 pl-4 my-5 text-[var(--text-secondary)] italic"
                    {...props}
                  />
                ),
                strong: (props) => (
                  <strong className="text-[var(--text-primary)] font-semibold" {...props} />
                ),
                code: ({ className, children, ...rest }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] text-[0.9em] border border-[var(--border-subtle)]"
                        {...rest}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  );
                },
                pre: (props) => (
                  <pre
                    className="my-4 p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-x-auto"
                    {...props}
                  />
                ),
                table: (props) => (
                  <div className="my-5 overflow-x-auto">
                    <table className="w-full text-sm border-collapse" {...props} />
                  </div>
                ),
                thead: (props) => (
                  <thead className="text-[var(--text-muted)]" {...props} />
                ),
                th: (props) => (
                  <th
                    className="text-left font-mono text-[10px] tracking-wider uppercase py-2 px-2 border-b border-[var(--border-subtle)]"
                    {...props}
                  />
                ),
                td: (props) => (
                  <td
                    className="align-top py-2 px-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    {...props}
                  />
                ),
                a: (props) => (
                  <a
                    className="text-[var(--amber)] hover:text-[var(--amber-dim)] underline underline-offset-4"
                    {...props}
                  />
                ),
              }}
            >
              {reviewMd}
            </ReactMarkdown>
          </article>
        </div>
      </section>
    </main>
  );
}
