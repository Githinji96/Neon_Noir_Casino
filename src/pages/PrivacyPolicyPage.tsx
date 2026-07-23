import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

// ─── Accordion Section ────────────────────────────────────────────────────────

function AccordionSection({ section, defaultOpen = false }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      id={section.id}
      className="rounded-xl border border-white/8 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group"
        aria-expanded={open}
      >
        <span
          className="font-orbitron text-sm font-bold tracking-wider group-hover:text-yellow-400 transition-colors"
          style={{ color: open ? '#FFD700' : 'rgba(255,255,255,0.85)' }}
        >
          {section.title}
        </span>
        <span
          className="ml-4 shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300"
          style={{
            borderColor: open ? '#FFD700' : 'rgba(255,255,255,0.15)',
            color: open ? '#FFD700' : 'rgba(255,255,255,0.4)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            ref={contentRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 text-sm text-white/70 leading-relaxed space-y-3 border-t border-white/5">
              {section.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function TableOfContents({ sections, activeId }: { sections: Section[]; activeId: string }) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <nav aria-label="Table of contents" className="flex flex-col gap-1">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => scrollTo(s.id)}
          className="text-left text-xs font-orbitron tracking-wider px-3 py-2 rounded-lg transition-all duration-200"
          style={{
            color: activeId === s.id ? '#FFD700' : 'rgba(255,255,255,0.45)',
            background: activeId === s.id ? 'rgba(255,215,0,0.08)' : 'transparent',
            borderLeft: activeId === s.id ? '2px solid #FFD700' : '2px solid transparent',
          }}
        >
          {s.title}
        </button>
      ))}
    </nav>
  );
}

// ─── Privacy Policy Page ──────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const [activeId, setActiveId] = useState('');
  const [showTop, setShowTop] = useState(false);

  const sections: Section[] = [
    {
      id: 'information-we-collect',
      title: '1. Information We Collect',
      content: (
        <>
          <p>When you create an account or use our services, we collect the following categories of personal information:</p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-yellow-400/80 font-semibold font-orbitron text-xs tracking-wider mb-1">Identity & Contact</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Phone Number</li>
                <li>Date of Birth</li>
                <li>Username</li>
                <li>Password (stored in encrypted form only — never as plain text)</li>
              </ul>
            </div>
            <div>
              <p className="text-yellow-400/80 font-semibold font-orbitron text-xs tracking-wider mb-1">Technical & Device Data</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>IP Address</li>
                <li>Device Information (type, model, operating system)</li>
                <li>Browser Information (type, version, language settings)</li>
                <li>Login History (timestamps, location data)</li>
              </ul>
            </div>
            <div>
              <p className="text-yellow-400/80 font-semibold font-orbitron text-xs tracking-wider mb-1">Financial & Gaming Data</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Deposit &amp; Withdrawal History</li>
                <li>Betting History</li>
                <li>Game Statistics (session duration, win/loss records, wager amounts)</li>
              </ul>
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'how-we-use',
      title: '2. How We Use Your Information',
      content: (
        <>
          <p>We use the personal information we collect for the following legitimate purposes:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Account creation and authentication</li>
            <li>Identity verification (Know Your Customer — KYC)</li>
            <li>Processing deposit and withdrawal transactions</li>
            <li>Fraud detection and prevention</li>
            <li>Responsible gambling monitoring and intervention</li>
            <li>Providing customer support services</li>
            <li>Regulatory compliance and legal obligations</li>
            <li>Improving platform performance and user experience</li>
            <li>Security monitoring and incident response</li>
          </ul>
          <p className="mt-3 text-white/50 text-xs">
            We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
          </p>
        </>
      ),
    },
    {
      id: 'cookies',
      title: '3. Cookies',
      content: (
        <>
          <p>
            Neon Noir Casino uses cookies and similar tracking technologies to enhance your experience. Cookies
            are small data files stored on your device that allow us to remember information between visits.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { type: 'Essential', desc: 'Authentication and session management — required for the platform to function.' },
              { type: 'Preference', desc: 'Remembering your language, currency, and display preferences.' },
              { type: 'Analytics', desc: 'Understanding how users interact with the platform to improve it.' },
              { type: 'Security', desc: 'Detecting and preventing fraudulent or suspicious activity.' },
              { type: 'Performance', desc: 'Monitoring platform speed and reliability.' },
            ].map(({ type, desc }) => (
              <div key={type} className="flex gap-3">
                <span className="font-orbitron text-yellow-400/80 text-xs shrink-0 mt-0.5 w-24">{type}</span>
                <span className="text-white/60 text-xs leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-white/60">
            You may manage your cookie preferences through your browser settings at any time. Disabling essential
            cookies may affect the functionality of your account.
          </p>
        </>
      ),
    },
    {
      id: 'payment-information',
      title: '4. Payment Information',
      content: (
        <>
          <p>Your financial security is our priority. When you make deposits or withdrawals:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Card details are <strong className="text-white">never stored</strong> on our servers. All card transactions are handled by certified Payment Card Industry (PCI-DSS) compliant payment processors.</li>
            <li>M-Pesa transactions are securely processed through Safaricom's Daraja API with end-to-end encryption.</li>
            <li>All payment data transmitted between you and our platform is protected by SSL/TLS encryption.</li>
            <li>We retain only the minimum transaction metadata required for regulatory compliance and dispute resolution.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'data-security',
      title: '5. Data Security',
      content: (
        <>
          <p>We implement industry-standard security measures to protect your personal information:</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '🔒', label: 'SSL Encryption', desc: 'All data in transit is encrypted using TLS 1.2+.' },
              { icon: '🔑', label: 'Password Hashing', desc: 'Passwords are hashed with bcrypt before storage.' },
              { icon: '🗄️', label: 'Database Encryption', desc: 'Sensitive fields are encrypted at rest.' },
              { icon: '🛡️', label: 'Firewall Protection', desc: 'Multi-layer network and application firewalls.' },
              { icon: '👥', label: 'Access Controls', desc: 'Role-based access — only authorised staff can view data.' },
              { icon: '🔍', label: 'Security Audits', desc: 'Regular penetration testing and vulnerability reviews.' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.08)' }}>
                <span className="text-lg shrink-0">{icon}</span>
                <div>
                  <p className="text-yellow-400/80 font-semibold text-xs font-orbitron">{label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-white/50 text-xs">
            Despite our best efforts, no system is completely invulnerable. In the event of a data breach that
            affects your rights, we will notify you in accordance with applicable data protection laws.
          </p>
        </>
      ),
    },
    {
      id: 'responsible-gambling',
      title: '6. Responsible Gambling',
      content: (
        <>
          <p>
            We are committed to promoting responsible gambling. Your data may be used to safeguard your wellbeing:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Detecting patterns that may indicate problem gambling or addiction</li>
            <li>Proactively offering self-exclusion options</li>
            <li>Applying and enforcing deposit and loss limits</li>
            <li>Restricting or suspending access when necessary to prevent harm</li>
          </ul>
          <p className="mt-3 text-white/60">
            If you believe you may have a gambling problem, please contact our support team or visit a recognised
            responsible gambling organisation in your jurisdiction.
          </p>
        </>
      ),
    },
    {
      id: 'third-party-services',
      title: '7. Third-Party Services',
      content: (
        <>
          <p>
            To operate the platform, we work with carefully selected third-party service providers. We share only
            the minimum information necessary for each service to perform its function:
          </p>
          <div className="mt-3 space-y-2">
            {[
              { provider: 'Payment Gateway', data: 'Transaction amounts, payment method identifiers' },
              { provider: 'Email Provider', data: 'Email address, communication content' },
              { provider: 'SMS Provider', data: 'Phone number, OTP/notification messages' },
              { provider: 'Analytics Provider', data: 'Anonymised usage data, session metrics' },
            ].map(({ provider, data }) => (
              <div key={provider} className="flex gap-3 items-start">
                <span className="text-yellow-400/70 font-orbitron text-xs shrink-0 mt-0.5 w-36">{provider}</span>
                <span className="text-white/55 text-xs">{data}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-white/50 text-xs">
            All third parties are bound by data processing agreements and are prohibited from using your information
            for purposes other than those specified.
          </p>
        </>
      ),
    },
    {
      id: 'user-rights',
      title: '8. Your Rights',
      content: (
        <>
          <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li><strong className="text-white">Right of Access</strong> — Request a copy of the data we hold about you.</li>
            <li><strong className="text-white">Right to Portability</strong> — Download your data in a machine-readable format.</li>
            <li><strong className="text-white">Right to Rectification</strong> — Update inaccurate or incomplete information in your profile.</li>
            <li><strong className="text-white">Right to Erasure</strong> — Request account deletion and removal of personal data (subject to legal retention obligations).</li>
            <li><strong className="text-white">Right to Correction</strong> — Request correction of any factual errors in your records.</li>
            <li><strong className="text-white">Right to Withdraw Consent</strong> — Withdraw marketing consent at any time via your account settings or by contacting support.</li>
          </ul>
          <p className="mt-3 text-white/50 text-xs">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:bonfacegithinji64@gmail.com" className="text-yellow-400 hover:underline">
              bonfacegithinji64@gmail.com
            </a>. We will respond within 30 days.
          </p>
        </>
      ),
    },
    {
      id: 'data-retention',
      title: '9. Data Retention',
      content: (
        <>
          <p>
            We retain your personal data only for as long as is necessary to fulfil the purposes for which it was
            collected, including:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>For the duration of your account being active</li>
            <li>As required by applicable laws, regulations, or licensing obligations (typically 5–7 years for financial records)</li>
            <li>For the period necessary to resolve disputes or enforce our agreements</li>
          </ul>
          <p className="mt-3 text-white/60">
            When your data is no longer required, it is securely deleted or anonymised.
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: '10. Contact Us',
      content: (
        <>
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy, you can reach us through the following channels:</p>
          <div className="mt-4 space-y-3">
            <a
              href="mailto:bonfacegithinji64@gmail.com"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-400/20 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all group"
            >
              <span className="text-xl">✉️</span>
              <div>
                <p className="font-orbitron text-xs text-yellow-400/80 tracking-wider">Support Email</p>
                <p className="text-white/70 text-sm mt-0.5 group-hover:text-white transition-colors">bonfacegithinji64@gmail.com</p>
              </div>
            </a>
            <a
              href="tel:+254703302801"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-400/20 hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all group"
            >
              <span className="text-xl">📞</span>
              <div>
                <p className="font-orbitron text-xs text-yellow-400/80 tracking-wider">Phone / WhatsApp</p>
                <p className="text-white/70 text-sm mt-0.5 group-hover:text-white transition-colors">+254 703 302 801</p>
              </div>
            </a>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-xl">💬</span>
              <div>
                <p className="font-orbitron text-xs text-white/50 tracking-wider">Live Chat</p>
                <p className="text-white/50 text-sm mt-0.5">Available in-app for registered players</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-xl">🆘</span>
              <div>
                <p className="font-orbitron text-xs text-white/50 tracking-wider">Help Center</p>
                <p className="text-white/50 text-sm mt-0.5">FAQs and guides available on our platform</p>
              </div>
            </div>
          </div>
        </>
      ),
    },
  ];

  // Scroll spy
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
      let current = '';
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 120) current = s.id;
        }
      }
      setActiveId(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative min-h-screen" style={{ background: '#050505' }}>
      {/* Glow orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 pb-20">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-white/30 font-orbitron tracking-wider mb-6">
            <Link to="/" className="hover:text-yellow-400/70 transition-colors">HOME</Link>
            <span>›</span>
            <span className="text-yellow-400/60">PRIVACY POLICY</span>
          </div>

          <div className="text-center">
            <h1
              className="font-orbitron font-black text-3xl sm:text-4xl tracking-widest mb-3"
              style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}
            >
              PRIVACY POLICY
            </h1>
            <div className="h-px w-48 mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }} />
            <p className="text-white/40 text-sm font-orbitron tracking-widest">
              Last Updated: July 2026
            </p>
          </div>

          {/* Introduction */}
          <div
            className="mt-8 max-w-3xl mx-auto text-center px-4 py-5 rounded-2xl border"
            style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.12)' }}
          >
            <p className="text-white/70 leading-relaxed">
              Neon Noir Casino values your privacy and is committed to protecting your personal information.
              This Privacy Policy explains what data we collect, how we use it, and the rights you have over it.
              By using our platform, you agree to the practices described in this document.
            </p>
          </div>
        </motion.div>

        {/* ── Layout: TOC + Content ── */}
        <div className="flex gap-8 items-start">

          {/* Sticky TOC — desktop only */}
          <aside className="hidden lg:block w-64 shrink-0 sticky top-20 self-start">
            <div
              className="rounded-xl p-4 border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <p className="font-orbitron text-xs tracking-widest text-yellow-400/60 uppercase mb-3">
                Contents
              </p>
              <TableOfContents sections={sections} activeId={activeId} />
            </div>
          </aside>

          {/* Sections */}
          <div className="flex-1 space-y-3 min-w-0">
            {sections.map((section, i) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <AccordionSection section={section} defaultOpen={i === 0} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div
          className="mt-12 text-center p-6 rounded-2xl border"
          style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.12)' }}
        >
          <p className="text-white/50 text-sm mb-4">
            Also review our Terms & Conditions for information about your account rules and gameplay policies.
          </p>
          <Link
            to="/terms"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-orbitron text-xs font-bold tracking-widest text-black transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}
          >
            VIEW TERMS & CONDITIONS →
          </Link>
        </div>
      </main>

      {/* Back to Top */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shadow-lg hover:brightness-110 transition-all text-black print:hidden"
            style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 0 20px rgba(255,215,0,0.4)' }}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, footer, aside, .fixed { display: none !important; }
          main { max-width: 100% !important; padding: 1rem !important; }
          .rounded-xl { border-radius: 0 !important; }
          * { color: #000 !important; background: #fff !important; border-color: #ccc !important; }
        }
      `}</style>
    </div>
  );
}
