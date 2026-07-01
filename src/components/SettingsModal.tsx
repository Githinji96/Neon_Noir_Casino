import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

type Tab = 'account' | 'wallet' | 'game' | 'notifications' | 'security' | 'preferences';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'account',       icon: '👤', label: 'Account' },
  { id: 'wallet',        icon: '💰', label: 'Wallet & Limits' },
  { id: 'game',          icon: '🎮', label: 'Game' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'security',      icon: '🔐', label: 'Security' },
  { id: 'preferences',   icon: '🌐', label: 'Preferences' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-yellow-400' : 'bg-white/20'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5">
      <span className="text-white/70 text-sm shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-orbitron text-xs text-yellow-400/60 tracking-widest uppercase mt-4 mb-1">{children}</p>;
}

export default function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const saveToSupabase = useSettingsStore((s) => s.saveToSupabase);
  const loadFromSupabase = useSettingsStore((s) => s.loadFromSupabase);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const balance = useGameStore((s) => s.balance);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('account');
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    loadFromSupabase(user.id);
    supabase.from('profiles').select('username').eq('id', user.id).single()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen]);

  // Apply theme to document root
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else {
      document.documentElement.classList.remove('theme-light');
    }
  }, [settings.theme]);

  async function handleSave() {
    if (user?.id) await saveToSupabase(user.id);
    useGameStore.setState({ soundEnabled: settings.soundEnabled });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleChangePassword() {
    setPwMsg('');
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Passwords do not match'); return; }
    if (pwForm.next.length < 8) { setPwMsg('Min 8 characters'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setPwLoading(false);
    setPwMsg(error ? error.message : '✓ Password updated!');
    if (!error) setPwForm({ next: '', confirm: '' });
  }

  async function handleLogout() {
    closeSettings();
    await signOut();
    useGameStore.setState({ balance: 0 });
    navigate('/auth/login');
  }

  async function handleDeleteAccount() {
    if (!user?.id) return;
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.signOut();
    useGameStore.setState({ balance: 0 });
    closeSettings();
    navigate('/auth/login');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-overlay"
          className="fixed inset-0 z-[200] flex justify-start items-stretch"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSettings}
        >
          <motion.div
            key="settings-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col overflow-hidden"
            style={{
              background: settings.theme === 'light'
                ? 'linear-gradient(160deg, #ffffff 0%, #f0f2f5 100%)'
                : 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              borderRight: `1px solid ${settings.theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,215,0,0.15)'}`,
              boxShadow: '8px 0 40px rgba(0,0,0,0.3)',
              width: '520px',
              height: '100vh',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div>
                <p className="font-orbitron text-xs text-white/30 tracking-widest uppercase">Configuration</p>
                <h2 className="font-orbitron text-xl font-bold text-yellow-400 tracking-widest">SETTINGS</h2>
              </div>
              <button onClick={closeSettings} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">✕</button>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-44 shrink-0 border-r border-white/10 flex flex-col py-3 overflow-y-auto">
                <div className="flex flex-col gap-1 flex-1">
                  {TABS.map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-left text-xs font-orbitron tracking-wider transition-all ${
                        tab === t.id ? 'text-yellow-400 bg-yellow-400/10 border-r-2 border-yellow-400' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                      }`}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-xs font-orbitron tracking-wider text-red-400 hover:bg-red-400/10 transition-all border-t border-white/10 mt-2">
                  <span>🚪</span> Logout
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">

                {tab === 'account' && (
                  <div>
                    <SectionTitle>Profile</SectionTitle>
                    <Row label="Username">
                      <span className="font-orbitron text-sm text-cyan-400">{username || user?.email?.split('@')[0] || '—'}</span>
                    </Row>
                    <div className="flex flex-col py-3 border-b border-white/5 gap-0.5">
                      <span className="text-white/70 text-sm">Email</span>
                      <span className="text-sm text-white/60 break-all">{user?.email ?? '—'}</span>
                    </div>
                    <Row label="Balance">
                      <span className="font-orbitron text-sm text-yellow-400">KES {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </Row>
                  </div>
                )}

                {tab === 'wallet' && (
                  <div>
                    <SectionTitle>Responsible Gambling</SectionTitle>
                    <Row label="Enable Limits">
                      <Toggle checked={settings.responsibleGambling} onChange={(v) => updateSettings({ responsibleGambling: v })} />
                    </Row>
                    {settings.responsibleGambling && (
                      <>
                        <SectionTitle>Deposit Limits (KES)</SectionTitle>
                        {(['dailyDepositLimit', 'weeklyDepositLimit', 'monthlyDepositLimit'] as const).map((key) => (
                          <Row key={key} label={key.replace('DepositLimit', '').replace('daily', 'Daily').replace('weekly', 'Weekly').replace('monthly', 'Monthly')}>
                            <input type="number" min={0} value={settings[key] || ''} placeholder="0 = no limit"
                              onChange={(e) => updateSettings({ [key]: Number(e.target.value) })}
                              className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:outline-none text-right" />
                          </Row>
                        ))}
                        <SectionTitle>Loss Limits</SectionTitle>
                        <Row label="Daily Loss (KES)">
                          <input type="number" min={0} value={settings.dailyLossLimit || ''} placeholder="0 = no limit"
                            onChange={(e) => updateSettings({ dailyLossLimit: Number(e.target.value) })}
                            className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:outline-none text-right" />
                        </Row>
                      </>
                    )}
                  </div>
                )}

                {tab === 'game' && (
                  <div>
                    <SectionTitle>Sound</SectionTitle>
                    <Row label="Sound Effects"><Toggle checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} /></Row>
                    <Row label="Background Music"><Toggle checked={settings.musicEnabled} onChange={(v) => updateSettings({ musicEnabled: v })} /></Row>
                    <SectionTitle>Animation Speed</SectionTitle>
                    <Row label="Speed">
                      <div className="flex gap-1">
                        {(['slow', 'normal', 'fast'] as const).map((s) => (
                          <button key={s} onClick={() => updateSettings({ animationSpeed: s })}
                            className={`px-3 py-1 rounded-lg text-xs font-orbitron capitalize transition-colors ${settings.animationSpeed === s ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </Row>
                    <SectionTitle>Auto-Spin</SectionTitle>
                    <Row label="Spins">
                      <select value={settings.autoSpinCount} onChange={(e) => updateSettings({ autoSpinCount: Number(e.target.value) })}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:outline-none">
                        {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Row>
                    <Row label="Stop on Win"><Toggle checked={settings.stopOnWin} onChange={(v) => updateSettings({ stopOnWin: v })} /></Row>
                  </div>
                )}

                {tab === 'notifications' && (
                  <div>
                    <SectionTitle>Notifications</SectionTitle>
                    {([
                      { label: 'Promotions', key: 'notifPromotions' },
                      { label: 'Jackpot Alerts', key: 'notifJackpot' },
                      { label: 'Win Notifications', key: 'notifWins' },
                      { label: 'Security Alerts', key: 'notifSecurity' },
                    ] as const).map(({ label, key }) => (
                      <Row key={key} label={label}>
                        <Toggle checked={settings[key]} onChange={(v) => updateSettings({ [key]: v })} />
                      </Row>
                    ))}
                  </div>
                )}

                {tab === 'security' && (
                  <div>
                    <SectionTitle>Change Password</SectionTitle>
                    <div className="flex flex-col gap-2 mt-2">
                      {(['next', 'confirm'] as const).map((k) => (
                        <div key={k}>
                          <label className="text-white/40 text-xs">{k === 'next' ? 'New Password' : 'Confirm Password'}</label>
                          <input type="password" value={pwForm[k]}
                            onChange={(e) => setPwForm((p) => ({ ...p, [k]: e.target.value }))}
                            className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400/50" />
                        </div>
                      ))}
                      {pwMsg && <p className={`text-xs ${pwMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{pwMsg}</p>}
                      <button onClick={handleChangePassword} disabled={pwLoading}
                        className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-orbitron text-xs font-bold tracking-widest hover:bg-yellow-300 transition-colors disabled:opacity-50">
                        {pwLoading ? 'UPDATING...' : 'UPDATE PASSWORD'}
                      </button>
                    </div>
                    <SectionTitle>Sessions</SectionTitle>
                    <button onClick={() => supabase.auth.signOut({ scope: 'global' }).then(() => { closeSettings(); navigate('/auth/login'); })}
                      className="mt-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 font-orbitron text-xs tracking-widest hover:bg-red-600/30 transition-colors">
                      LOGOUT ALL DEVICES
                    </button>
                    <SectionTitle>Danger Zone</SectionTitle>
                    <div className="mt-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                      <p className="text-white/40 text-xs mb-3">Permanently delete your account. Cannot be undone.</p>
                      {!deleteConfirm ? (
                        <button onClick={() => setDeleteConfirm(true)}
                          className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 font-orbitron text-xs tracking-widest hover:bg-red-600/40 transition-colors">
                          DELETE ACCOUNT
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={handleDeleteAccount}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-orbitron text-xs tracking-widest hover:bg-red-500 transition-colors">
                            YES, DELETE
                          </button>
                          <button onClick={() => setDeleteConfirm(false)}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white/60 font-orbitron text-xs tracking-widest hover:bg-white/20 transition-colors">
                            CANCEL
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'preferences' && (
                  <div>
                    <SectionTitle>Theme</SectionTitle>
                    <Row label="Theme">
                      <div className="flex gap-1">
                        {(['dark', 'light'] as const).map((t) => (
                          <button key={t} onClick={() => updateSettings({ theme: t })}
                            className={`px-3 py-1 rounded-lg text-xs font-orbitron capitalize transition-colors ${settings.theme === t ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
                            {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                          </button>
                        ))}
                      </div>
                    </Row>
                    <SectionTitle>Language</SectionTitle>
                    <Row label="Language">
                      <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:outline-none">
                        <option value="en">🇬🇧 English</option>
                        <option value="sw">🇰🇪 Swahili</option>
                        <option value="fr">🇫🇷 French</option>
                      </select>
                    </Row>
                    <SectionTitle>Currency</SectionTitle>
                    <Row label="Currency"><span className="font-orbitron text-sm text-yellow-400">KES</span></Row>
                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
              <p className="text-white/20 text-xs">Changes saved locally</p>
              <button onClick={handleSave}
                className="px-6 py-2 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                {saved ? '✓ SAVED' : 'SAVE'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
