import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CASINO_LINKS = [
  { label: 'Slots',                 path: '/' },
  { label: 'Live Tables',           path: '/live-tables' },
  { label: 'Progressive Jackpots',  path: '/jackpots' },
  { label: 'VIP Club',              path: '/vip' },
  { label: 'Leaderboard',           path: '/' },
];

const ACCOUNT_LINKS = [
  { label: 'Login',                 path: '/auth/login' },
  { label: 'Register',              path: '/auth/signup' },
  { label: 'Deposit',               path: '/', action: 'deposit' },
  { label: 'Withdraw',              path: '/', action: 'withdraw' },
  { label: 'Responsible Gambling',  path: '/' },
];

const SUPPORT_LINKS = [
  { label: 'Help Center',           path: '/contact' },
  { label: 'FAQ',                   path: '/contact' },
  { label: 'Contact Support',       path: '/contact' },
  { label: 'Terms & Conditions',    path: '/terms' },
  { label: 'Privacy Policy',        path: '/privacy-policy' },
  { label: 'AML Policy',            path: '/contact' },
  { label: 'Responsible Gambling',  path: '/contact' },
];

const SOCIAL = [
  { label: 'Facebook',  href: '#', icon: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
  { label: 'X',         href: '#', icon: 'M4 4l16 16M4 20L20 4' },
  { label: 'Instagram', href: '#', icon: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zm1.5-4.87h.01M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z' },
  { label: 'Telegram',  href: '#', icon: 'M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z' },
  { label: 'Discord',   href: '#', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { label: 'YouTube',   href: '#', icon: 'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98l5.75 3.02-5.75 3.02z' },
];

const BOTTOM_LINKS = [
  { label: 'Cookies Policy', path: '/' },
  { label: 'Privacy',        path: '/privacy-policy' },
  { label: 'Terms',          path: '/terms' },
  { label: 'Sitemap',        path: '/' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FooterLink({ label, path }: { label: string; path: string }) {
  return (
    <li>
      <Link
        to={path}
        className="text-white/40 text-sm hover:text-[#FFD700] transition-colors duration-200 hover:translate-x-1 inline-block"
      >
        {label}
      </Link>
    </li>
  );
}

function SocialIcon({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-white/40
        hover:text-[#FFD700] hover:border-[#FFD700]/50 hover:shadow-[0_0_12px_rgba(255,215,0,0.3)]
        transition-all duration-200"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d={icon} />
      </svg>
    </a>
  );
}

// Mobile accordion section
function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-orbitron text-xs tracking-widest text-white/70 uppercase">{title}</span>
        <span className={`text-[#FFD700] text-lg transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex flex-col gap-2.5 pb-4"
          >
            {children}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Footer ──────────────────────────────────────────────────────────────

export default function Footer() {
  const navigate = useNavigate();
  const [showTop, setShowTop] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [emailError, setEmailError] = useState('');
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  // Scroll to top button
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fade-in on enter viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.05 }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setSubscribed(true);
  }

  return (
    <>
      {/* ── Footer ── */}
      <motion.footer
        ref={footerRef}
        initial={{ opacity: 0, y: 20 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        style={{ background: '#050505', borderTop: '1px solid rgba(255,215,0,0.08)' }}
        className="w-full mt-auto"
        aria-label="Site footer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12">

          {/* ── Desktop grid ── */}
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">

            {/* Brand */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div>
                <h2
                  className="font-orbitron font-black text-2xl tracking-widest"
                  style={{ color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.4)' }}
                >
                  NEON NOIR
                </h2>
                <p className="font-orbitron text-[10px] tracking-[0.4em] text-white/30 mt-0.5">CASINO</p>
              </div>
              <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                Experience next-generation online casino entertainment with premium slots, live tables,
                progressive jackpots, and exclusive VIP rewards.
              </p>

              {/* Social icons */}
              <div className="flex gap-2 flex-wrap">
                {SOCIAL.map((s) => <SocialIcon key={s.label} {...s} />)}
              </div>

              {/* Newsletter */}
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2 mt-1">
                <label className="text-white/40 text-xs font-orbitron tracking-widest uppercase">Newsletter</label>
                {subscribed ? (
                  <p className="text-[#FFD700] text-xs font-orbitron">✓ You're subscribed!</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                        placeholder="your@email.com"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FFD700]/50 transition-colors min-w-0"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-lg font-orbitron text-xs text-black font-bold shrink-0 transition-all hover:brightness-110"
                        style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}
                      >
                        JOIN
                      </button>
                    </div>
                    {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
                  </>
                )}
              </form>
            </div>

            {/* Casino Games */}
            <div className="flex flex-col gap-3">
              <h3 className="font-orbitron text-xs tracking-widest text-white/60 uppercase">Casino Games</h3>
              <ul className="flex flex-col gap-2.5">
                {CASINO_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
              </ul>
            </div>

            {/* Player Account */}
            <div className="flex flex-col gap-3">
              <h3 className="font-orbitron text-xs tracking-widest text-white/60 uppercase">Player Account</h3>
              <ul className="flex flex-col gap-2.5">
                {ACCOUNT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
              </ul>
            </div>

            {/* Support */}
            <div className="flex flex-col gap-3">
              <h3 className="font-orbitron text-xs tracking-widest text-white/60 uppercase">Support</h3>
              <ul className="flex flex-col gap-2.5">
                {SUPPORT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
              </ul>
            </div>
          </div>

          {/* ── Mobile accordion ── */}
          <div className="md:hidden flex flex-col">
            {/* Brand always visible on mobile */}
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <h2
                  className="font-orbitron font-black text-xl tracking-widest"
                  style={{ color: '#FFD700', textShadow: '0 0 12px rgba(255,215,0,0.4)' }}
                >
                  NEON NOIR
                </h2>
                <p className="font-orbitron text-[9px] tracking-[0.4em] text-white/30">CASINO</p>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Experience next-generation online casino entertainment with premium slots, live tables,
                progressive jackpots, and exclusive VIP rewards.
              </p>
              <div className="flex gap-2 flex-wrap">
                {SOCIAL.map((s) => <SocialIcon key={s.label} {...s} />)}
              </div>
            </div>

            <AccordionSection title="Casino Games">
              {CASINO_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
            </AccordionSection>
            <AccordionSection title="Player Account">
              {ACCOUNT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
            </AccordionSection>
            <AccordionSection title="Support">
              {SUPPORT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
            </AccordionSection>
          </div>

          {/* ── Payment Methods ── */}
          <div className="mt-10 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-orbitron text-xs tracking-widest text-white/40 uppercase mb-4">Payment Methods</p>
            <div className="flex flex-wrap gap-3 items-center">
              {/* M-Pesa */}
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5"
                title="M-Pesa"
              >
                <span className="text-green-400 font-bold text-sm font-orbitron">M</span>
                <span className="text-white/60 text-xs font-orbitron">PESA</span>
              </div>
              {/* Visa */}
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
                <span className="text-blue-400 font-black text-sm italic">VISA</span>
              </div>
              {/* Mastercard */}
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
                <span className="w-4 h-4 rounded-full bg-red-500 inline-block -mr-2" />
                <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block opacity-90" />
                <span className="text-white/60 text-xs font-orbitron ml-2">Mastercard</span>
              </div>
              {/* Airtel Money */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
                <span className="text-red-400 font-bold text-sm font-orbitron">AIRTEL</span>
                <span className="text-white/60 text-xs font-orbitron">Money</span>
              </div>
            </div>
          </div>

          {/* ── Responsible gambling notice ── */}
          <div
            className="mt-8 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
            style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}
          >
            <span className="text-[#FFD700] text-lg">⚠️</span>
            <p className="text-white/30 text-xs leading-relaxed">
              <span className="text-white/50 font-semibold">Play Responsibly.</span>{' '}
              Gambling can be addictive. Please play within your means. Players must be 18+.
              If you feel you have a gambling problem, please seek help.
            </p>
            <span className="ml-auto shrink-0 px-3 py-1 rounded-full font-orbitron text-[10px] font-bold text-[#FFD700] border border-[#FFD700]/30">
              18+
            </span>
          </div>

          {/* ── Bottom bar ── */}
          <div
            className="mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-white/25 text-xs text-center sm:text-left">
              © 2026 Neon Noir Casino. All Rights Reserved.
            </p>

            {/* Bottom links */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {BOTTOM_LINKS.map((l, i) => (
                <span key={l.label} className="flex items-center gap-4">
                  <Link to={l.path} className="text-white/25 text-xs hover:text-white/60 transition-colors">
                    {l.label}
                  </Link>
                  {i < BOTTOM_LINKS.length - 1 && <span className="text-white/10 text-xs">·</span>}
                </span>
              ))}
            </div>

            <p className="text-white/15 text-[10px] font-mono">v1.0.0</p>
          </div>
        </div>
      </motion.footer>

      {/* ── Back to Top ── */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center
              text-black font-bold text-lg shadow-lg hover:brightness-110 transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#FFD700,#FFA500)',
              boxShadow: '0 0 20px rgba(255,215,0,0.4)',
            }}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
