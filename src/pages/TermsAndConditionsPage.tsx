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

// ─── Terms & Conditions Page ──────────────────────────────────────────────────

export default function TermsAndConditionsPage() {
  const [activeId, setActiveId] = useState('');
  const [showTop, setShowTop] = useState(false);

  const sections: Section[] = [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      content: (
        <>
          <p>
            By accessing, registering on, or using the Neon Noir Casino platform (the "Platform"), you acknowledge
            that you have read, understood, and agree to be bound by these Terms &amp; Conditions, our{' '}
            <Link to="/privacy-policy" className="text-yellow-400 hover:underline">Privacy Policy</Link>, and any
            other policies referenced herein.
          </p>
          <p className="mt-2">
            If you do not agree with any part of these Terms, you must immediately cease using the Platform.
            Your continued use of the Platform constitutes ongoing acceptance of any updates or changes to
            these Terms.
          </p>
        </>
      ),
    },
    {
      id: 'eligibility',
      title: '2. Eligibility',
      content: (
        <>
          <p>To register and play on Neon Noir Casino, you must:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Be at least <strong className="text-white">18 years of age</strong> (or the legal gambling age in your jurisdiction, whichever is higher)</li>
            <li>Meet all applicable local, national, and international legal requirements for online gambling</li>
            <li>Provide accurate, complete, and up-to-date personal information during registration</li>
            <li>Complete identity verification (KYC) when required</li>
            <li>Not be a resident of a jurisdiction where online gambling is prohibited</li>
          </ul>
          <p className="mt-3 text-white/50 text-xs">
            We reserve the right to request proof of age and identity at any time. Accounts found to be
            operated by underage individuals will be immediately suspended and any winnings forfeited.
          </p>
        </>
      ),
    },
    {
      id: 'accounts',
      title: '3. Player Accounts',
      content: (
        <>
          <p>By creating an account, you agree to the following:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li><strong className="text-white">One account per player</strong> — You may only hold one account on the Platform. Multiple accounts are strictly prohibited.</li>
            <li><strong className="text-white">Confidentiality</strong> — You are solely responsible for maintaining the security of your login credentials. Do not share your password with anyone.</li>
            <li><strong className="text-white">No impersonation</strong> — You may not impersonate any other person, create accounts using false identities, or misrepresent your identity in any way.</li>
            <li><strong className="text-white">No account sharing</strong> — Accounts may not be shared with, transferred to, or operated by any other person.</li>
          </ul>
          <p className="mt-3 text-white/60">
            You are responsible for all activity that occurs under your account. If you suspect unauthorised
            access, contact our support team immediately.
          </p>
        </>
      ),
    },
    {
      id: 'deposits',
      title: '4. Deposits',
      content: (
        <>
          <p>The following terms apply to all deposits made on the Platform:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Deposits are credited to your account upon successful confirmation from the payment provider.</li>
            <li>Minimum and maximum deposit limits apply and may vary by payment method. These are displayed at the time of transaction.</li>
            <li>You must only use payment methods registered in your own name. Third-party deposits are not permitted.</li>
            <li>Deposits confirmed as fraudulent or disputed by your payment provider may result in immediate account suspension.</li>
            <li>Neon Noir Casino is not responsible for delays caused by payment processors or network issues.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'withdrawals',
      title: '5. Withdrawals',
      content: (
        <>
          <p>The following terms apply to all withdrawal requests:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Identity verification (KYC) must be completed before any withdrawal can be processed.</li>
            <li>All withdrawals are reviewed for fraud prevention purposes prior to approval.</li>
            <li>Processing times vary depending on the payment method and may range from a few hours to several business days.</li>
            <li>The casino reserves the right to reject or delay withdrawal requests flagged as suspicious or in breach of these Terms.</li>
            <li>Withdrawals will only be made to the same payment method used for deposits where technically possible.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'bonuses',
      title: '6. Bonuses & Promotions',
      content: (
        <>
          <p>All bonuses and promotions offered by Neon Noir Casino are subject to the following conditions:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>All bonuses carry wagering requirements that must be met before withdrawals can be made. Specific requirements are stated at the time of the offer.</li>
            <li>Abuse, exploitation, or manipulation of bonus promotions — including but not limited to bonus hunting or hedge betting — may result in the forfeiture of bonus funds and associated winnings.</li>
            <li>Players with duplicate accounts are ineligible for any bonuses or promotional offers.</li>
            <li>Bonuses cannot be combined unless explicitly stated otherwise.</li>
            <li>The casino reserves the right to amend, suspend, or terminate any promotion at any time.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'jackpots',
      title: '7. Progressive Jackpots',
      content: (
        <>
          <p>The following rules govern participation in and payouts from Neon Noir Casino's progressive jackpots:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Jackpot pools are funded by contributions from qualifying bets placed by players across the Platform.</li>
            <li>Jackpot winners are determined solely by the certified Random Number Generator (RNG) algorithm embedded in the game engine — there is no human intervention in jackpot outcomes.</li>
            <li>Only one player wins each jackpot payout cycle. In the event of a technical dispute, the recorded game server data is the authoritative source.</li>
            <li>The jackpot pool resets to a predefined seed value immediately following a verified win.</li>
            <li>The casino is not liable for jackpot amounts displayed due to synchronisation delays between user sessions.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'fair-gaming',
      title: '8. Fair Gaming',
      content: (
        <>
          <p>
            Neon Noir Casino is committed to providing a fair and transparent gaming environment:
          </p>
          <div className="mt-3 space-y-3">
            {[
              { icon: '🎲', title: 'Certified RNG', desc: 'All game outcomes are determined by a certified Random Number Generator, ensuring every spin, deal, and roll is completely random and independent.' },
              { icon: '🔬', title: 'Independent Testing', desc: 'Our games and RNG systems are subject to independent fairness testing and auditing to verify compliance with stated Return to Player (RTP) percentages.' },
              { icon: '🚫', title: 'No Manipulation', desc: 'No manual manipulation of game outcomes is possible by any staff member or automated system outside of the certified RNG process.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.08)' }}>
                <span className="text-lg shrink-0">{icon}</span>
                <div>
                  <p className="text-yellow-400/80 font-semibold text-xs font-orbitron">{title}</p>
                  <p className="text-white/55 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'responsible-gambling',
      title: '9. Responsible Gambling',
      content: (
        <>
          <p>
            We are dedicated to promoting responsible gambling. The following tools are available to all players:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-3 ml-1">
            <li><strong className="text-white">Deposit Limits</strong> — Set daily, weekly, or monthly deposit caps on your account.</li>
            <li><strong className="text-white">Loss Limits</strong> — Restrict the maximum amount you can lose in a defined period.</li>
            <li><strong className="text-white">Self-Exclusion</strong> — Temporarily or permanently exclude yourself from the Platform.</li>
            <li><strong className="text-white">Cooling-Off Periods</strong> — Request a temporary pause from gameplay (24 hours to 6 months).</li>
            <li><strong className="text-white">Permanent Closure</strong> — Request permanent account closure at any time by contacting support.</li>
          </ul>
          <p className="mt-3 text-white/60">
            Gambling should always be entertainment. If you feel gambling is negatively affecting your life,
            please seek help. Contact our support team or reach out to a recognised problem gambling helpline
            in your region.
          </p>
        </>
      ),
    },
    {
      id: 'prohibited-activities',
      title: '10. Prohibited Activities',
      content: (
        <>
          <p>The following activities are strictly prohibited on the Platform and will result in immediate account action:</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Cheating or use of unauthorised software',
              'Using bots, scripts, or automated systems',
              'Exploiting software bugs or glitches',
              'Reverse engineering any part of the Platform',
              'Using stolen, fraudulent, or third-party payment methods',
              'Money laundering or financing illegal activities',
              'Colluding with other players to manipulate outcomes',
              'Creating multiple accounts',
              'Providing false identity information',
              'Attempting to compromise platform security',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-white/60">
                <span className="text-red-400/70 mt-0.5 shrink-0">✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-white/50 text-xs">
            Violations may result in account suspension, confiscation of funds, permanent ban, and referral to
            law enforcement authorities where applicable.
          </p>
        </>
      ),
    },
    {
      id: 'account-suspension',
      title: '11. Account Suspension',
      content: (
        <>
          <p>
            Neon Noir Casino reserves the right to restrict, suspend, or permanently close any account at its
            sole discretion, including but not limited to the following circumstances:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Evidence or reasonable suspicion of fraud or criminal activity</li>
            <li>Unusual or suspicious betting patterns</li>
            <li>Anti-Money Laundering (AML) compliance concerns</li>
            <li>Detection of duplicate accounts</li>
            <li>Abuse of bonuses or promotional offers</li>
            <li>Failure to complete required identity verification</li>
            <li>Breach of any provision of these Terms</li>
          </ul>
          <p className="mt-3 text-white/60">
            In cases of account suspension pending investigation, we will endeavour to communicate the reason
            to you where legally permissible.
          </p>
        </>
      ),
    },
    {
      id: 'liability',
      title: '12. Limitation of Liability',
      content: (
        <>
          <p>
            To the fullest extent permitted by applicable law, Neon Noir Casino shall not be liable for any
            losses or damages arising from:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>Internet outages, connectivity failures, or network interruptions beyond our control</li>
            <li>Failures or downtime of third-party service providers (payment gateways, SMS providers, etc.)</li>
            <li>Issues with your personal device, browser, or operating environment</li>
            <li>Losses incurred as a result of your own gameplay decisions</li>
            <li>Unauthorised access to your account resulting from your failure to maintain credential security</li>
          </ul>
          <p className="mt-3 text-white/60">
            Nothing in these Terms limits our liability for fraud, wilful misconduct, or any liability that
            cannot be excluded by applicable law.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      title: '13. Changes to Terms',
      content: (
        <>
          <p>
            Neon Noir Casino may update, modify, or replace these Terms &amp; Conditions and any linked policies
            at any time. When we make material changes:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-2 ml-1">
            <li>The "Last Updated" date at the top of this page will be revised.</li>
            <li>We may notify registered players via email or an in-platform notification.</li>
            <li>Your continued use of the Platform following any update constitutes acceptance of the revised Terms.</li>
          </ul>
          <p className="mt-3 text-white/60">
            We recommend reviewing this page periodically to stay informed of any changes.
          </p>
        </>
      ),
    },
    {
      id: 'contact',
      title: '14. Contact Us',
      content: (
        <>
          <p>If you have any questions about these Terms &amp; Conditions or need assistance, contact us:</p>
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
      <div className="fixed top-0 right-1/4 w-96 h-96 rounded-full pointer-events-none opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
      <div className="fixed bottom-1/3 left-1/4 w-80 h-80 rounded-full pointer-events-none opacity-5 blur-3xl"
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
            <span className="text-yellow-400/60">TERMS & CONDITIONS</span>
          </div>

          <div className="text-center">
            <h1
              className="font-orbitron font-black text-3xl sm:text-4xl tracking-widest mb-3"
              style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}
            >
              TERMS & CONDITIONS
            </h1>
            <div className="h-px w-48 mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }} />
            <p className="text-white/40 text-sm font-orbitron tracking-widest">
              Last Updated: July 2026
            </p>
          </div>

          {/* Warning banner */}
          <div
            className="mt-8 max-w-3xl mx-auto px-4 py-5 rounded-2xl border"
            style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.12)' }}
          >
            <div className="flex gap-3 items-start">
              <span className="text-2xl shrink-0">⚖️</span>
              <p className="text-white/70 leading-relaxed text-sm">
                Please read these Terms &amp; Conditions carefully before using Neon Noir Casino. By creating an
                account or placing a bet, you confirm that you are of legal gambling age and that you agree to
                be bound by these terms. Gambling involves financial risk — only play with money you can afford to lose.
              </p>
            </div>
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
            Also review our Privacy Policy for information on how we collect and protect your personal data.
          </p>
          <Link
            to="/privacy-policy"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-orbitron text-xs font-bold tracking-widest text-black transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}
          >
            VIEW PRIVACY POLICY →
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
