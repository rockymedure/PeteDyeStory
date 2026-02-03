import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface ActRow {
  id: string;
  act_number: number;
  title: string;
  description: string | null;
}

const getActs = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('acts')
      .select('id, act_number, title, description')
      .order('act_number', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ActRow[];
  },
  ['acts-for-outline'],
  { revalidate: 60 }
);

async function getOutlineMarkdown() {
  const outlinePath = path.join(process.cwd(), 'src', 'content', 'film-outline.md');
  return readFile(outlinePath, 'utf8');
}

function actLabel(n: number) {
  const roman = n === 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n);
  return `Act ${roman}`;
}

export default async function OutlinePage() {
  const [acts, outlineMd] = await Promise.all([getActs(), getOutlineMarkdown()]);

  return (
    <main className="min-h-screen relative">
      <AppHeader status="Outline" />

      <section className="pt-32 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-6">
              Film Outline
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 leading-[1.1]">
              Story spine + source footage
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Read the producer outline and jump straight into the clips that support each act.
            </p>

            {acts.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {acts.map((act) => (
                  <Link
                    key={act.id}
                    href={`/acts/${act.id}`}
                    className="px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--amber)] hover:border-[var(--border-visible)] transition-colors"
                  >
                    {actLabel(act.act_number)} clips
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          <article className="card p-6 md:p-8 overflow-hidden">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => <h2 className="text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-4" {...props} />,
                h2: (props) => <h3 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)] mt-8 mb-3" {...props} />,
                h3: (props) => <h4 className="text-lg md:text-xl font-semibold text-[var(--amber)] mt-7 mb-3" {...props} />,
                h4: (props) => <h5 className="text-base font-semibold text-[var(--text-primary)] mt-6 mb-2" {...props} />,
                p: (props) => <p className="text-[var(--text-secondary)] leading-relaxed my-3" {...props} />,
                ul: (props) => <ul className="my-3 pl-5 space-y-2 list-disc text-[var(--text-secondary)]" {...props} />,
                ol: (props) => <ol className="my-3 pl-5 space-y-2 list-decimal text-[var(--text-secondary)]" {...props} />,
                li: (props) => <li className="leading-relaxed" {...props} />,
                hr: () => <div className="my-8 h-px bg-[var(--border-subtle)]" />,
                blockquote: (props) => (
                  <blockquote
                    className="border-l-2 border-[var(--amber)]/40 pl-4 my-5 text-[var(--text-secondary)] italic"
                    {...props}
                  />
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
                thead: (props) => <thead className="text-[var(--text-muted)]" {...props} />,
                th: (props) => <th className="text-left font-mono text-[10px] tracking-wider uppercase py-2 px-2 border-b border-[var(--border-subtle)]" {...props} />,
                td: (props) => <td className="align-top py-2 px-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]" {...props} />,
                a: (props) => (
                  <a
                    className="text-[var(--amber)] hover:text-[var(--amber-dim)] underline underline-offset-4"
                    {...props}
                  />
                ),
              }}
            >
              {outlineMd}
            </ReactMarkdown>
          </article>

          <aside className="space-y-6 lg:sticky lg:top-20">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase">
                  Related clips
                </span>
                <span className="flex-1 h-px bg-[var(--border-subtle)]" />
              </div>

              {acts.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No acts found in the database yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {acts.map((act) => (
                    <Link
                      key={act.id}
                      href={`/acts/${act.id}`}
                      className="block group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
                            {actLabel(act.act_number)}
                          </div>
                          <div className="text-[var(--text-primary)] font-medium truncate group-hover:text-[var(--amber)] transition-colors">
                            {act.title}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--text-muted)] group-hover:text-[var(--amber)] transition-colors">
                          Open →
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">
                          {act.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase">
                  Tip
                </span>
                <span className="flex-1 h-px bg-[var(--border-subtle)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Use the outline to pick a beat, then jump into the act page to audition clips quickly in the player.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

