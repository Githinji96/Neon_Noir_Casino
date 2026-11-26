import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

interface FAQCategory {
  id: string;
  icon: string;
  label: string;
  items: FAQItem[];
}

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'account',
    icon: '👤',
    label: 'Account & Registration',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up" on the homepage and fill in your name, email, M-Pesa number, date of birth, and a secure password. You must be at least 18 years old to register.',
      },
      {
        q: 'What are the age requirements?',
        a: 'You must be 18 years of age or older to open an account and play at Neon Noir Casino. We verify age during registration and during KYC checks.',
      },
      {
        q: 'I forgot my password. How do I reset it?',
        a: 'Click "Forgot Password?" on the login page. Enter your registered email address and we will send you a password reset link. The link expires after 1 hour.',
      },
      {
        q: 'Can I change my email address?',
        a: 'Email changes require identity verification. Contact our support team at bonfacegithinji64@gmail.com with a copy of your ID and we will process the request within 48 hours.',
      },
      {
        q: 'Can I have more than one account?',
        a: 'No. Each player is permitted one account only. Duplicate accounts are prohibited under our Terms & Conditions and may result in the suspension of all associated accounts and forfeiture of funds.',
      },
      {
        q: 'How do I verify my account (KYC)?',
        a: 'Send a copy of your national ID (both sides) and a recent utility bill or bank statement (dated within 3 months) to bonfacegithinji64@gmail.com. Verification is usually completed within 24 hours on business days.',
      },
      {
        q: 'How do I close or delete my account?',
        a: (
          <>
            You can delete your account from <strong className="text-white">Settings → Security → Delete Account</strong>. Enter your password to confirm. This action is permanent and removes all associated data, subject to legal retention requirements.
          </>
        ),
      },
    ],
  },
  {
    id: 'deposits',
    icon: '💳',
    label: 'Deposits',
    items: [
      {
        q: 'How do I deposit money?',
        a: 'Click the DEPOSIT button in the navigation bar. Enter your M-Pesa number and the amount you wish to deposit. You will receive an STK push (pop-up prompt) on your phone — enter your M-Pesa PIN to confirm. Funds appear in your account within seconds.',
      },
      {
        q: 'What is the minimum deposit amount?',
        a: 'The minimum deposit is KES 100.',
      },
      {
        q: "My deposit didn't reflect. What should I do?",
        a: "Wait up to 5 minutes — network delays occasionally slow the confirmation. If your balance still hasn't updated after 10 minutes, note your M-Pesa transaction confirmation message (with the receipt number) and contact support. Do not attempt a second deposit until the first is resolved.",
      },
      {
        q: 'Is there a deposit limit?',
        a: 'You can set voluntary daily, weekly, or monthly deposit limits in Settings → Wallet & Limits as part of our responsible gambling tools.',
      },
      {
        q: 'Which payment methods are accepted?',
        a: 'Currently we accept M-Pesa (Safaricom) for all deposits and withdrawals. Airtel Money and card payments are coming soon.',
      },
      {
        q: 'Are there any fees on deposits?',
        a: 'Neon Noir Casino does not charge fees on deposits. Standard M-Pesa transaction charges from Safaricom may apply.',
      },
    ],
  },
  {
    id: 'withdrawals',
    icon: '💸',
    label: 'Withdrawals',
    items: [
      {
        q: 'How do I withdraw my winnings?',
        a: 'Click WITHDRAW in the navigation bar. Enter the amount and confirm with your account password. Withdrawal requests are reviewed and paid to your registered M-Pesa number.',
      },
      {
        q: 'How long do withdrawals take?',
        a: 'Withdrawals are reviewed within 1–24 hours after your KYC verification is complete. Once approved, funds are sent to your M-Pesa number immediately.',
      },
      {
        q: 'What is the minimum withdrawal amount?',
        a: 'The minimum withdrawal is KES 500.',
      },
      {
        q: 'Why has my withdrawal been delayed?',
        a: 'Withdrawals may be delayed if your account is pending KYC verification, if a security review is in progress, or if your withdrawal was submitted outside business hours. Contact support with your withdrawal reference for a status update.',
      },
      {
        q: 'Can I change my M-Pesa withdrawal number?',
        a: (
          <>
            Yes. Go to <strong className="text-white">Settings → Account → M-Pesa Account</strong> and click <strong className="text-white">Change</strong>. For security, a 24-hour hold is placed on withdrawals after a phone number change. You will also need to verify your password to complete the change.
          </>
        ),
      },
      {
        q: 'My withdrawal failed. What happens to the funds?',
        a: "If a withdrawal fails (e.g. the M-Pesa number was incorrect), the funds are returned to your casino balance automatically within 1 hour. Contact support if they don't appear.",
      },
    ],
  },
  {
    id: 'games',
    icon: '🎰',
    label: 'Games & Betting',
    items: [
      {
        q: 'What games are available?',
        a: 'Neon Noir Casino offers video slots, live dealer table games (Roulette, Blackjack, Baccarat), and progressive jackpots. New games are added regularly.',
      },
      {
        q: 'What is RTP (Return to Player)?',
        a: 'RTP is the percentage of total wagers a game pays back to players over time. For example, a 96% RTP means the game returns KES 96 for every KES 100 wagered on average. Individual sessions can vary significantly above or below this figure.',
      },
      {
        q: 'What are the minimum and maximum bet limits?',
        a: 'Bet limits vary by game. You can view the specific limits in the game information panel before starting play. You can also set personal bet limits in Settings.',
      },
      {
        q: 'Can I play for free?',
        a: 'Demo/free-play mode is not currently available. All gameplay requires a funded account.',
      },
      {
        q: 'What is a Progressive Jackpot?',
        a: 'A progressive jackpot is a prize pool that grows each time a player places a bet on linked games. When a jackpot is won, the pool resets to its base amount and starts growing again. Visit the Jackpots page for current prize amounts.',
      },
      {
        q: 'What happens if my game disconnects mid-spin?',
        a: 'If your connection drops during a spin, the round is completed server-side. When you reconnect, the result will already be recorded and your balance will reflect the outcome. No spin result is lost.',
      },
    ],
  },
  {
    id: 'bonuses',
    icon: '🎁',
    label: 'Bonuses & VIP',
    items: [
      {
        q: 'What is the VIP program?',
        a: 'The Neon Noir VIP Club rewards loyal players with cashback, exclusive bonuses, and personalised service. You earn VIP points on every bet placed. Points accumulate to unlock Bronze, Silver, Gold, Platinum, and Diamond tiers.',
      },
      {
        q: 'How do I earn VIP points?',
        a: 'VIP points are awarded automatically on every eligible wager. Visit the VIP page to see your current points balance, tier, and upcoming rewards.',
      },
      {
        q: 'Do bonus winnings count toward withdrawals?',
        a: 'Bonus terms, including any wagering requirements, are specified when the bonus is credited. Read the specific terms attached to each bonus before accepting it.',
      },
      {
        q: 'How do I claim weekly cashback?',
        a: 'Weekly cashback is calculated automatically based on your net losses during the qualifying period. Eligible amounts are credited to your account every Monday.',
      },
    ],
  },
  {
    id: 'responsible',
    icon: '🛡️',
    label: 'Responsible Gambling',
    items: [
      {
        q: 'How do I set deposit and loss limits?',
        a: (
          <>
            Go to <strong className="text-white">Settings → Wallet & Limits</strong> and enable Responsible Gambling. You can set daily, weekly, and monthly deposit limits, as well as a daily loss limit. Limits take effect immediately.
          </>
        ),
      },
      {
        q: 'How do I self-exclude?',
        a: (
          <>
            You can temporarily suspend your account from <strong className="text-white">Settings → Security → Suspend My Account</strong>. For a longer exclusion, contact support at bonfacegithinji64@gmail.com. We process exclusion requests within 24 hours.
          </>
        ),
      },
      {
        q: 'I think I have a gambling problem. Where can I get help?',
        a: (
          <>
            You are not alone. Please contact our support team immediately — we will help you set limits or self-exclude without judgment. You can also reach out to:
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Responsible Gambling Kenya (RGK)</li>
              <li>Gamblers Anonymous Kenya</li>
              <li>The BCLB Responsible Gambling Helpline</li>
            </ul>
          </>
        ),
      },
      {
        q: 'Are there tools to help me control my play?',
        a: 'Yes. Deposit limits, loss limits, session time reminders, and self-exclusion are all available from your account settings. We also monitor play patterns and may proactively reach out if we notice signs of problematic behaviour.',
      },
    ],
  },
  {
    id: 'security',
    icon: '🔒',
    label: 'Security & Privacy',
    items: [
      {
        q: 'How is my personal data protected?',
        a: 'All data in transit is encrypted with TLS 1.2+. Passwords are hashed using bcrypt and never stored in plain text. We do not sell your personal data to third parties. See our Privacy Policy for full details.',
      },
      {
        q: 'How do I keep my account secure?',
        a: 'Use a strong, unique password. Never share your credentials. Enable two-factor authentication if available. Log out on shared devices. Contact support immediately if you suspect unauthorised access.',
      },
      {
        q: 'What should I do if I suspect unauthorised activity on my account?',
        a: 'Contact support immediately via email or phone. We will lock your account and investigate. Change your password from a secure device as soon as possible.',
      },
      {
        q: 'Does Neon Noir Casino share my data with third parties?',
        a: 'We share only the minimum data necessary with vetted service providers (e.g. payment processors). We never sell your data for marketing purposes. Full details are in our Privacy Policy.',
      },
    ],
  },
  {
    id: 'technical',
    icon: '⚙️',
    label: 'Technical Support',
    items: [
      {
        q: 'Which browsers are supported?',
        a: 'Neon Noir Casino works on all modern browsers — Chrome, Edge, Firefox, and Safari. We recommend keeping your browser up to date for the best experience.',
      },
      {
        q: 'The game is not loading. What should I do?',
        a: 'Clear your browser cache and cookies, then refresh. Disable any ad-blockers for the site. Check your internet connection. If the issue persists, contact support with a screenshot and your browser/device details.',
      },
      {
        q: 'Can I play on my phone?',
        a: 'Yes. The platform is fully responsive and works on all modern mobile browsers without requiring an app download.',
      },
      {
        q: 'Why is my balance showing incorrectly?',
        a: "Refresh the page. If the discrepancy persists after 5 minutes, contact support with your account email and the transaction details. Do not attempt another deposit or withdrawal until the issue is resolved.",
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ item, index, isOpen, onToggle }: {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden transition-colors duration-200"
      style={{
        background: isOpen ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.03)',
        borderColor: isOpen ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.07)',
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between px-5 py-4 text-left gap-4 group"
        aria-expanded={isOpen}
        id={`faq-btn-${index}`}
        aria-controls={`faq-panel-${index}`}
      >
        <span
          className="text-sm font-semibold leading-snug transition-colors group-hover:text-yellow-400"
          style={{ color: isOpen ? '#FFD700' : 'rgba(255,255,255,0.85)' }}
        >
          {item.q}
        </span>
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 mt-0.5"
          aria-hidden="true"
          style={{
            borderColor: isOpen ? '#FFD700' : 'rgba(255,255,255,0.15)',
            color: isOpen ? '#FFD700' : 'rgba(255,255,255,0.4)',
            transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-panel-${index}`}
            role="region"
            aria-labelledby={`faq-btn-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 text-sm text-white/60 leading-relaxed border-t border-white/5">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryTab({
  category,
  isActive,
  onClick,
}: {
  category: FAQCategory;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-orbitron tracking-wider transition-all duration-200 whitespace-nowrap"
      style={{
        background: isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isActive ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
        color: isActive ? '#FFD700' : 'rgba(255,255,255,0.5)',
      }}
    >
      <span>{category.icon}</span>
      <span className="text-xs">{category.label}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState(FAQ_CATEGORIES[0].id);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const currentCategory = FAQ_CATEGORIES.find((c) => c.id === activeCategory)!;

  // When searching, filter across all categories
  const searchResults = search.trim().length > 1
    ? FAQ_CATEGORIES.flatMap((cat) =>
        cat.items
          .filter(
            (item) =>
              item.q.toLowerCase().includes(search.toLowerCase()) ||
              (typeof item.a === 'string' && item.a.toLowerCase().includes(search.toLowerCase()))
          )
          .map((item) => ({ ...item, category: cat.label, categoryIcon: cat.icon }))
      )
    : null;

  // Reset open item when category changes
  useEffect(() => { setOpenIndex(0); }, [activeCategory]);

  const items = searchResults
    ? searchResults
    : currentCategory.items.map((item) => ({ ...item, category: undefined, categoryIcon: undefined }));

  return (
    <div className="relative min-h-screen" style={{ background: '#050505' }}>
      {/* Background glows */}
      <div className="fixed top-0 right-1/4 w-96 h-96 rounded-full pointer-events-none opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }} />
      <div className="fixed bottom-1/3 left-1/4 w-80 h-80 rounded-full pointer-events-none opacity-4 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />

      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 pb-20">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-10"
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-white/30 font-orbitron tracking-wider mb-6">
            <Link to="/" className="hover:text-yellow-400/70 transition-colors">HOME</Link>
            <span>›</span>
            <span className="text-yellow-400/60">FAQ</span>
          </div>

          <div className="text-center">
            <h1
              className="font-orbitron font-black text-3xl sm:text-4xl tracking-widest mb-3"
              style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.4)' }}
            >
              FREQUENTLY ASKED QUESTIONS
            </h1>
            <div
              className="h-px w-64 mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }}
            />
            <p className="text-white/45 text-sm max-w-lg mx-auto leading-relaxed">
              Find answers to the most common questions about accounts, payments, games, and more.
              Can't find what you're looking for?{' '}
              <Link to="/contact" className="text-yellow-400 hover:underline transition-colors">
                Contact our support team.
              </Link>
            </p>
          </div>
        </motion.div>

        {/* ── Search ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <span className="text-white/30 shrink-0" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              aria-label="Search FAQ"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none shrink-0"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Category tabs (hidden during search) ── */}
        {!searchResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="mb-6 flex flex-wrap gap-2"
            role="tablist"
            aria-label="FAQ categories"
          >
            {FAQ_CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                category={cat}
                isActive={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </motion.div>
        )}

        {/* ── Search results header ── */}
        {searchResults && (
          <div className="mb-4 text-sm text-white/40 font-orbitron tracking-wider">
            {searchResults.length === 0
              ? `No results for "${search}"`
              : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${search}"`}
          </div>
        )}

        {/* ── FAQ Items ── */}
        <motion.div
          key={searchResults ? 'search' : activeCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-2"
          role={!searchResults ? 'tabpanel' : undefined}
          aria-label={!searchResults ? currentCategory.label : undefined}
        >
          {items.length === 0 && searchResults ? (
            <div className="text-center py-12">
              <p className="text-white/25 text-4xl mb-3">🔍</p>
              <p className="text-white/40 text-sm">No questions match your search.</p>
              <button
                onClick={() => setSearch('')}
                className="mt-4 text-yellow-400 text-xs font-orbitron hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            items.map((item, i) => (
              <div key={i}>
                {/* Show category badge when showing search results */}
                {searchResults && 'category' in item && item.category && (
                  <p className="text-[10px] font-orbitron tracking-widest text-yellow-400/50 uppercase mb-1.5 mt-3 first:mt-0">
                    {item.categoryIcon} {item.category}
                  </p>
                )}
                <FAQItem
                  item={item}
                  index={i}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              </div>
            ))
          )}
        </motion.div>

        {/* ── Still need help? CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="mt-12 rounded-2xl border p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,165,0,0.03))',
            borderColor: 'rgba(255,215,0,0.15)',
          }}
        >
          <p className="font-orbitron text-sm font-bold text-white tracking-widest mb-2">
            STILL HAVE QUESTIONS?
          </p>
          <p className="text-white/45 text-sm mb-5">
            Our support team is available 7 days a week to help you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="mailto:bonfacegithinji64@gmail.com"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest text-black transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 0 16px rgba(255,215,0,0.25)' }}
            >
              ✉️ EMAIL SUPPORT
            </a>
            <Link
              to="/contact"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest text-yellow-400 transition-all hover:bg-yellow-400/10"
              style={{ border: '1px solid rgba(255,215,0,0.3)' }}
            >
              📝 SEND A MESSAGE
            </Link>
          </div>
        </motion.div>

        {/* ── Bottom links ── */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs font-orbitron text-white/30 tracking-wider">
          <Link to="/terms"          className="hover:text-yellow-400/70 transition-colors">Terms &amp; Conditions</Link>
          <span className="text-white/10">·</span>
          <Link to="/privacy-policy" className="hover:text-yellow-400/70 transition-colors">Privacy Policy</Link>
          <span className="text-white/10">·</span>
          <Link to="/contact"        className="hover:text-yellow-400/70 transition-colors">Contact Support</Link>
          <span className="text-white/10">·</span>
          <Link to="/"               className="hover:text-yellow-400/70 transition-colors">Back to Casino</Link>
        </div>
      </main>
    </div>
  );
}
