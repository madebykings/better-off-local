'use client';

import { useState, useTransition } from 'react';
import { sendCrmEmail } from '@/lib/actions/crm';

type Template = { id: string; name: string; subject: string; body_html: string };

interface EmailComposerProps {
  businessId: string;
  defaultTo: string;
  templates: Template[];
  senderName: string;
  businessName: string;
  regionName: string;
  signupLink: string;
}

export function EmailComposer({
  businessId, defaultTo, templates, senderName, businessName, regionName, signupLink,
}: EmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) { setSubject(''); setBodyHtml(''); return; }
    const tmpl = templates.find((t) => t.id === id);
    if (!tmpl) return;

    const vars: Record<string, string> = {
      business_name: businessName,
      contact_name: 'there',
      region_name: regionName,
      sender_name: senderName,
      signup_link: signupLink,
      meeting_date: '',
      meeting_time: '',
    };

    function fill(text: string) {
      return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
    }

    setSubject(fill(tmpl.subject));
    setBodyHtml(fill(tmpl.body_html));
  }

  function handleSend() {
    setError(null);
    const fd = new FormData();
    fd.append('business_id', businessId);
    fd.append('to', defaultTo);
    fd.append('subject', subject);
    fd.append('body_html', bodyHtml);
    fd.append('template_id', templateId);

    startTransition(async () => {
      const result = await sendCrmEmail(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
        setOpen(false);
        setSubject(''); setBodyHtml(''); setTemplateId('');
      }
    });
  }

  return (
    <div>
      {sent && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Email sent successfully.
        </div>
      )}

      {!open ? (
        <button
          onClick={() => { setOpen(true); setSent(false); }}
          className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Compose email
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Send email</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">
              Cancel
            </button>
          </div>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Template</label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
            >
              <option value="">No template — write from scratch</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="email"
              value={defaultTo}
              readOnly
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Body (HTML supported)</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              placeholder="Email body…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-700 resize-y"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={isPending || !subject.trim() || !bodyHtml.trim()}
              className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? 'Sending…' : 'Send'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
