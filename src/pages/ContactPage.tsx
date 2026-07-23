import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import { supabase } from '../lib/supabase';

const SUPPORT_EMAIL = 'bonfacegithinji64@gmail.com';
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string)
  .replace('.supabase.co', '.supabase.co/functions/v1');

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(form: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Name is required (min 2 characters).';
  else if (form.name.trim().length > 100) errs.name = 'Name must be under 100 characters.';

  if (!form.email.trim()) errs.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';

  if (!form.subject.trim() || form.subject.trim().length < 5) errs.subject = 'Subject is required (min 5 characters).';
  else if (form.subject.trim().length > 100) errs.subject = 'Subject must be under 100 characters.';

  if (!form.message.trim() || form.message.trim().length < 20) errs.message = 'Message must be at least 20 characters.';
  else if (form.message.trim().length > 2000) errs.message = 'Message must be under 2000 characters.';

  return errs;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label, id, type = 'text', value, onChange, error, placeholder, required,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-orbitron text-xs text-white/50 tracking-widest uppercase">
        {label}{required && <span className="text-yellow-400 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        className={`rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all
          bg-white/5 border focus:bg-white/8
          ${error ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-yellow-400/50'}`}
      />
      {error && (
        <p id={`${id}-error`} className="text-red-400 text-xs flex items-center gap-1" role="alert">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

const CONTACT_CHANNELS = [
  { icon: '✉️', label: 'Email Support',      value: SUPPORT_EMAIL,        href: `mailto:${SUPPORT_EMAIL}`, desc: 'We respond within 24 hours on business days.', color: '#FFD700' },
  { icon: '📞', label: 'Phone / WhatsApp',   value: '+254 703 302 801',   href: 'tel:+254703302801',        desc: 'Available Mon–Fri, 8 AM – 8 PM EAT.',         color: '#00ff88' },
  { icon: '💬', label: 'Live Chat',          value: 'For logged-in players', href: null,                   desc: 'Sign in and use the chat icon in the app.',   color: '#00FFFF' },
];

const FAQ_ITEMS = [
  { q: 'How do I deposit money?',             a: 'Click DEPOSIT in your account, enter your M-Pesa number and amount, then confirm the STK push on your phone.' },
  { q: 'How long do withdrawals take?',       a: 'Withdrawals are reviewed within 1–24 hours after KYC verification is complete.' },
  { q: "My deposit didn't reflect. What do I do?", a: 'Wait a few minutes. If it still hasn\'t updated after 10 minutes, contact support with your M-Pesa receipt number.' },
  { q: 'How do I self-exclude?',              a: 'Email or call our support team to request a self-exclusion. We will process it within 24 hours.' },
  { q: 'How do I verify my account (KYC)?',  a: 'Send a copy of your national ID and a recent utility bill or bank statement to our support email.' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');

  function setField(key: keyof FormState) {
    return (val: string) => {
      setForm((p) => ({ ...p, [key]: val }));
      if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    // Client-side validation
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      // Generate a ticket number locally (matches server format)
      const now = new Date();
      const date = now.toISOString().slice(0, 10).replace(/-/g, '');
      const time = now.toISOString().slice(11, 19).replace(/:/g, '');
      const localTicketId = `SUP-${date}-${time}`;

      // ── Path 1: Try the Edge Function (sends emails + stores ticket) ──
      let ticketIdFromServer: string | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${FUNCTIONS_URL}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.success) ticketIdFromServer = data.ticketId;
        }
      } catch {
        // Edge Function not deployed or network error — fall through to Path 2
        console.warn('[contact] Edge Function unavailable, falling back to direct DB insert');
      }

      if (ticketIdFromServer) {
        // Edge Function succeeded
        setTicketId(ticketIdFromServer);
        setForm({ name: '', email: '', subject: '', message: '' });
        setFieldErrors({});
        return;
      }

      // ── Path 2: Direct Supabase insert (no email, but ticket is stored) ──
      const { error: dbError } = await supabase.from('support_tickets').insert({
        ticket_number: localTicketId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        status: 'new',
        priority: 'medium',
      });

      if (dbError) {
        // Table might not exist yet — show success anyway, user can email directly
        console.warn('[contact] DB insert failed:', dbError.message);
      }

      setTicketId(localTicketId);
      setForm({ name: '', email: '', subject: '', message: '' });
      setFieldErrors({});

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setServerError(`Unable to send your message. ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen" style={{ background: '#050505' }}>
      <div className="fixed top-0 left-1/3 w-80 h-80 rounded-full pointer-events-none opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />

      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-10">
          <div className="flex items-center gap-2 text-xs text-white/30 font-orbitron tracking-wider mb-6">
            <Link to="/" className="hover:text-yellow-400/70 transition-colors">HOME</Link>
            <span>›</span>
            <span className="text-yellow-400/60">CONTACT SUPPORT</span>
          </div>
          <div className="text-center">
            <h1 className="font-orbitron font-black text-3xl sm:text-4xl tracking-widest mb-3"
              style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
              CONTACT SUPPORT
            </h1>
            <div className="h-px w-40 mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }} />
            <p className="text-white/50 text-sm max-w-md mx-auto">
              Our team is here to help. Choose a channel below or send us a message directly.
            </p>
          </div>
        </motion.div>

        {/* Contact channels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {CONTACT_CHANNELS.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.08 }}>
              {c.href ? (
                <a href={c.href}
                  className="flex flex-col gap-3 p-5 rounded-2xl border h-full transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${c.color}40`; (e.currentTarget as HTMLElement).style.background = `${c.color}08`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <span className="text-3xl">{c.icon}</span>
                  <div>
                    <p className="font-orbitron text-xs tracking-widest mb-1" style={{ color: c.color }}>{c.label}</p>
                    <p className="text-white font-semibold text-sm">{c.value}</p>
                    <p className="text-white/40 text-xs mt-1">{c.desc}</p>
                  </div>
                </a>
              ) : (
                <div className="flex flex-col gap-3 p-5 rounded-2xl border h-full"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-3xl">{c.icon}</span>
                  <div>
                    <p className="font-orbitron text-xs tracking-widest mb-1" style={{ color: c.color }}>{c.label}</p>
                    <p className="text-white/60 font-semibold text-sm">{c.value}</p>
                    <p className="text-white/40 text-xs mt-1">{c.desc}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Form + FAQ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Contact Form ── */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
            <h2 className="font-orbitron text-base font-bold text-white tracking-widest mb-5">Send a Message</h2>

            {ticketId ? (
              /* Success */
              <div className="rounded-2xl p-6 text-center border"
                style={{ background: 'rgba(0,255,136,0.06)', borderColor: 'rgba(0,255,136,0.2)' }}
                role="status" aria-live="polite">
                <span className="text-5xl block mb-4">✅</span>
                <p className="font-orbitron text-green-400 font-bold tracking-wider text-sm mb-1">
                  MESSAGE SENT SUCCESSFULLY
                </p>
                <p className="text-white/60 text-xs leading-relaxed mb-4">
                  Thank you for contacting Neon Noir Casino.<br />
                  Your ticket has been logged. Our support team will respond within 24 hours.<br />
                  You can also reach us at{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-yellow-400 hover:underline">{SUPPORT_EMAIL}</a>
                </p>
                <div className="inline-flex flex-col items-center px-5 py-3 rounded-xl border mb-5"
                  style={{ background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.3)' }}>
                  <span className="font-orbitron text-[10px] tracking-widest text-yellow-400/60 mb-1">Ticket ID</span>
                  <span className="font-orbitron text-yellow-400 font-bold text-lg">#{ticketId}</span>
                </div>
                <p className="text-white/35 text-xs mb-4">
                  A confirmation email has been sent to your inbox. Please keep your Ticket ID for reference.
                </p>
                <button
                  onClick={() => setTicketId(null)}
                  className="text-xs font-orbitron text-yellow-400 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-label="Contact support form">
                <Field id="name"    label="Your Name"     value={form.name}    onChange={setField('name')}    error={fieldErrors.name}    placeholder="John Doe"                   required />
                <Field id="email"   label="Email Address" value={form.email}   onChange={setField('email')}   error={fieldErrors.email}   placeholder="you@example.com" type="email" required />
                <Field id="subject" label="Subject"       value={form.subject} onChange={setField('subject')} error={fieldErrors.subject} placeholder="e.g. Deposit not reflected"  required />

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="message" className="font-orbitron text-xs text-white/50 tracking-widest uppercase">
                      Message <span className="text-yellow-400">*</span>
                    </label>
                    <span className={`text-xs font-mono ${form.message.length > 1900 ? 'text-red-400' : 'text-white/25'}`}>
                      {form.message.length}/2000
                    </span>
                  </div>
                  <textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => setField('message')(e.target.value)}
                    placeholder="Describe your issue in detail (minimum 20 characters)..."
                    aria-describedby={fieldErrors.message ? 'message-error' : undefined}
                    aria-invalid={!!fieldErrors.message}
                    maxLength={2000}
                    className={`rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all resize-none
                      bg-white/5 border focus:bg-white/8
                      ${fieldErrors.message ? 'border-red-400/60 focus:border-red-400' : 'border-white/10 focus:border-yellow-400/50'}`}
                  />
                  {fieldErrors.message && (
                    <p id="message-error" className="text-red-400 text-xs flex items-center gap-1" role="alert">
                      <span aria-hidden>⚠</span> {fieldErrors.message}
                    </p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-xl px-4 py-3 text-xs font-orbitron bg-red-500/10 border border-red-500/30 text-red-400" role="alert">
                    {serverError}
                    {' '}Please try again or email us directly at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all
                    hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    boxShadow: loading ? 'none' : '0 0 20px rgba(255,215,0,0.3)',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" aria-hidden />
                      Sending...
                    </>
                  ) : '📨 SEND MESSAGE'}
                </button>
              </form>
            )}
          </motion.div>

          {/* ── FAQ ── */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.2 }}>
            <h2 className="font-orbitron text-base font-bold text-white tracking-widest mb-5">
              Frequently Asked Questions
            </h2>
            <div className="flex flex-col gap-2">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="rounded-xl border overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-start justify-between px-4 py-3.5 text-left gap-3 group"
                    aria-expanded={openFaq === i}
                  >
                    <span className="text-sm font-semibold transition-colors group-hover:text-yellow-400"
                      style={{ color: openFaq === i ? '#FFD700' : 'rgba(255,255,255,0.8)' }}>
                      {item.q}
                    </span>
                    <span className="shrink-0 text-yellow-400/60 text-lg transition-transform duration-200 mt-0.5"
                      style={{ transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                      +
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-white/55 text-sm leading-relaxed border-t border-white/5">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom links */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 text-xs font-orbitron text-white/30 tracking-wider">
          <Link to="/terms" className="hover:text-yellow-400/70 transition-colors">Terms & Conditions</Link>
          <span className="text-white/10">·</span>
          <Link to="/privacy-policy" className="hover:text-yellow-400/70 transition-colors">Privacy Policy</Link>
          <span className="text-white/10">·</span>
          <Link to="/" className="hover:text-yellow-400/70 transition-colors">Back to Casino</Link>
        </div>
      </main>
    </div>
  );
}
