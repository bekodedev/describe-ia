'use client';

import { EDITED_CONTENT_MAX, type DescriptionDto } from '@describe-ia/shared';
import { useEffect, useRef, useState } from 'react';
import { saveEdit } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { friendlyError } from '@/lib/errors';
import { Button, Card, ErrorAlert, Spinner } from './ui';

const VARIANTS = {
  short: { label: 'Short', hint: 'One sentence' },
  medium: { label: 'Medium', hint: 'One paragraph' },
  seo: { label: 'SEO', hint: 'For search engines' },
} as const;

interface Props {
  description: DescriptionDto;
  onSaved: (updated: DescriptionDto) => void;
}

export function DescriptionCard({ description, onSaved }: Props) {
  const { label, hint } = VARIANTS[description.variant];
  const shown = description.editedContent ?? description.content;
  const edited = description.editedContent !== null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textarea.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await copyText(shown);
      setCopied(true);
      setError(null);
    } catch {
      setError('Could not copy to the clipboard. Select the text and copy it by hand.');
    }
  }

  function startEditing() {
    setDraft(shown);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { description: updated } = await saveEdit(description.id, draft);
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const trimmed = draft.trim();

  return (
    <Card className="p-6">
      <article aria-labelledby={`${description.id}-title`}>
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={`${description.id}-title`} className="text-lg font-bold text-slate-900">
            {label}
          </h2>
          <span className="text-sm text-slate-600">{hint}</span>
          {edited && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              Edited
            </span>
          )}
        </header>

        {editing ? (
          <div className="mt-4">
            <label htmlFor={`${description.id}-edit`} className="sr-only">
              Edit the {label.toLowerCase()} description
            </label>
            <textarea
              id={`${description.id}-edit`}
              ref={textarea}
              value={draft}
              rows={Math.min(14, Math.max(4, Math.ceil(draft.length / 80)))}
              maxLength={EDITED_CONTENT_MAX}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900"
            />
            <p className="mt-2 text-sm text-slate-600">
              {draft.length} / {EDITED_CONTENT_MAX} characters
            </p>
          </div>
        ) : (
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-800">
            {shown}
          </p>
        )}

        {edited && !editing && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowOriginal((value) => !value)}
              aria-expanded={showOriginal}
              className="rounded text-sm font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-900"
            >
              {showOriginal ? 'Hide original' : 'View original'}
            </button>
            {showOriginal && (
              <div className="mt-2 rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Original
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {description.content}
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          {!editing && <p className="text-sm text-slate-600">{shown.length} characters</p>}
          <div className={`flex gap-2 ${editing ? 'ml-auto' : ''}`}>
            {editing ? (
              <>
                <Button variant="quiet" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="!px-4 !py-2 text-sm"
                  onClick={save}
                  disabled={saving || trimmed.length === 0}
                >
                  {saving && <Spinner />}
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={startEditing}>
                  Edit<span className="sr-only"> the {label.toLowerCase()} description</span>
                </Button>
                <Button onClick={copy}>
                  {copied ? (
                    'Copied'
                  ) : (
                    <>
                      Copy<span className="sr-only"> the {label.toLowerCase()} description</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
          <span role="status" className="sr-only">
            {copied ? `${label} description copied to the clipboard` : ''}
          </span>
        </footer>
      </article>
    </Card>
  );
}
