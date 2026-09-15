/**
 * Neon Noir Casino — UI translations
 * Add keys here and consume via useTranslation() hook.
 * Only covers player-facing UI strings; admin panel stays in English.
 */

export type Locale = 'en' | 'sw' | 'fr';

export interface Translations {
  // Navbar
  nav_slots: string;
  nav_live_tables: string;
  nav_jackpots: string;
  nav_vip: string;
  nav_login: string;
  nav_signup: string;
  nav_deposit: string;
  nav_withdraw: string;
  nav_pending: string;

  // Auth
  auth_welcome_back: string;
  auth_sign_in_subtitle: string;
  auth_email: string;
  auth_password: string;
  auth_remember_me: string;
  auth_forgot_password: string;
  auth_sign_in: string;
  auth_no_account: string;
  auth_sign_up: string;

  // Casino Lobby
  lobby_featured: string;
  lobby_all_games: string;
  lobby_play_now: string;
  lobby_see_all: string;

  // Slot Machine
  slot_spin: string;
  slot_auto: string;
  slot_turbo: string;
  slot_bet_amount: string;
  slot_paytable: string;
  slot_no_funds: string;
  slot_win: string;
  slot_balance: string;
  slot_last_payout: string;
  slot_free_spins: string;
  slot_free_spins_remaining: string;
  slot_lobby: string;

  // Deposit Modal
  deposit_title: string;
  deposit_to: string;
  deposit_amount: string;
  deposit_button: string;
  deposit_min_max: string;
  deposit_verified: string;
  deposit_no_phone: string;

  // Withdrawal Modal
  withdraw_title: string;
  withdraw_available: string;
  withdraw_to: string;
  withdraw_amount: string;
  withdraw_button: string;
  withdraw_min: string;
  withdraw_max: string;
  withdraw_daily: string;
  withdraw_processing: string;

  // Settings
  settings_title: string;
  settings_save: string;
  settings_saved: string;

  // General
  loading: string;
  cancel: string;
  confirm: string;
  close: string;
  or: string;
}

const en: Translations = {
  nav_slots: 'Slots',
  nav_live_tables: 'Live Tables',
  nav_jackpots: 'Jackpots',
  nav_vip: 'VIP',
  nav_login: 'LOGIN',
  nav_signup: 'SIGN UP',
  nav_deposit: 'DEPOSIT',
  nav_withdraw: 'WITHDRAW',
  nav_pending: 'PENDING...',

  auth_welcome_back: 'Welcome Back',
  auth_sign_in_subtitle: 'Sign in to your account to continue playing',
  auth_email: 'Email',
  auth_password: 'Password',
  auth_remember_me: 'Remember me',
  auth_forgot_password: 'Forgot Password?',
  auth_sign_in: 'SIGN IN',
  auth_no_account: "Don't have an account?",
  auth_sign_up: 'Sign Up',

  lobby_featured: 'Featured Games',
  lobby_all_games: 'All Games',
  lobby_play_now: 'PLAY NOW',
  lobby_see_all: 'SEE ALL',

  slot_spin: 'SPIN',
  slot_auto: 'AUTO',
  slot_turbo: 'TURBO',
  slot_bet_amount: 'Bet Amount',
  slot_paytable: 'PAYTABLE',
  slot_no_funds: 'NO FUNDS',
  slot_win: 'WIN!',
  slot_balance: 'Balance',
  slot_last_payout: 'Last Payout',
  slot_free_spins: 'FREE SPINS',
  slot_free_spins_remaining: 'spins remaining',
  slot_lobby: '← LOBBY',

  deposit_title: 'M-PESA DEPOSIT',
  deposit_to: 'Deposit To',
  deposit_amount: 'Amount (KES)',
  deposit_button: 'DEPOSIT VIA M-PESA',
  deposit_min_max: 'Minimum: KES 10 | Maximum: KES 150,000',
  deposit_verified: 'VERIFIED',
  deposit_no_phone: 'No M-Pesa number on file',

  withdraw_title: 'WITHDRAW',
  withdraw_available: 'AVAILABLE',
  withdraw_to: 'Withdraw To',
  withdraw_amount: 'Amount (KES)',
  withdraw_button: 'REQUEST WITHDRAWAL',
  withdraw_min: 'Min',
  withdraw_max: 'Max',
  withdraw_daily: 'Daily',
  withdraw_processing: 'Processing: 1–24 hours · Admin review required',

  settings_title: 'SETTINGS',
  settings_save: 'SAVE',
  settings_saved: '✓ SAVED',

  loading: 'LOADING...',
  cancel: 'CANCEL',
  confirm: 'CONFIRM',
  close: 'CLOSE',
  or: 'OR',
};

const sw: Translations = {
  nav_slots: 'Nafasi',
  nav_live_tables: 'Meza za Moja kwa Moja',
  nav_jackpots: 'Jackpots',
  nav_vip: 'VIP',
  nav_login: 'INGIA',
  nav_signup: 'JISAJILI',
  nav_deposit: 'WEKA PESA',
  nav_withdraw: 'TOA PESA',
  nav_pending: 'INASUBIRI...',

  auth_welcome_back: 'Karibu Tena',
  auth_sign_in_subtitle: 'Ingia kwenye akaunti yako ili kuendelea kucheza',
  auth_email: 'Barua pepe',
  auth_password: 'Nywila',
  auth_remember_me: 'Nikumbuke',
  auth_forgot_password: 'Umesahau Nywila?',
  auth_sign_in: 'INGIA',
  auth_no_account: 'Huna akaunti?',
  auth_sign_up: 'Jisajili',

  lobby_featured: 'Michezo Iliyopendekezwa',
  lobby_all_games: 'Michezo Yote',
  lobby_play_now: 'CHEZA SASA',
  lobby_see_all: 'TAZAMA YOTE',

  slot_spin: 'ZUNGUKA',
  slot_auto: 'OTOMATIKI',
  slot_turbo: 'TURBO',
  slot_bet_amount: 'Kiasi cha Dau',
  slot_paytable: 'JEDWALI LA MALIPO',
  slot_no_funds: 'HAKUNA PESA',
  slot_win: 'UMESHINDA!',
  slot_balance: 'Salio',
  slot_last_payout: 'Malipo ya Mwisho',
  slot_free_spins: 'ZUNGUKO BILA MALIPO',
  slot_free_spins_remaining: 'zunguko zilizobaki',
  slot_lobby: '← UKUMBI',

  deposit_title: 'WEKA PESA - M-PESA',
  deposit_to: 'Weka kwa',
  deposit_amount: 'Kiasi (KES)',
  deposit_button: 'WEKA PESA KUPITIA M-PESA',
  deposit_min_max: 'Kiwango cha chini: KES 10 | Kiwango cha juu: KES 150,000',
  deposit_verified: 'IMETHIBITISHWA',
  deposit_no_phone: 'Hakuna nambari ya M-Pesa',

  withdraw_title: 'TOA PESA',
  withdraw_available: 'INAYOPATIKANA',
  withdraw_to: 'Toa kwa',
  withdraw_amount: 'Kiasi (KES)',
  withdraw_button: 'OMBA KUTOA PESA',
  withdraw_min: 'Kiwango cha chini',
  withdraw_max: 'Kiwango cha juu',
  withdraw_daily: 'Kila siku',
  withdraw_processing: 'Usindikaji: saa 1-24 · Ukaguzi wa msimamizi unahitajika',

  settings_title: 'MIPANGILIO',
  settings_save: 'HIFADHI',
  settings_saved: '✓ IMEHIFADHIWA',

  loading: 'INAPAKIA...',
  cancel: 'GHAIRI',
  confirm: 'THIBITISHA',
  close: 'FUNGA',
  or: 'AU',
};

const fr: Translations = {
  nav_slots: 'Machines à sous',
  nav_live_tables: 'Tables en direct',
  nav_jackpots: 'Jackpots',
  nav_vip: 'VIP',
  nav_login: 'CONNEXION',
  nav_signup: "S'INSCRIRE",
  nav_deposit: 'DÉPÔT',
  nav_withdraw: 'RETRAIT',
  nav_pending: 'EN ATTENTE...',

  auth_welcome_back: 'Bon retour',
  auth_sign_in_subtitle: 'Connectez-vous à votre compte pour continuer à jouer',
  auth_email: 'E-mail',
  auth_password: 'Mot de passe',
  auth_remember_me: 'Se souvenir de moi',
  auth_forgot_password: 'Mot de passe oublié?',
  auth_sign_in: 'SE CONNECTER',
  auth_no_account: "Vous n'avez pas de compte?",
  auth_sign_up: "S'inscrire",

  lobby_featured: 'Jeux en vedette',
  lobby_all_games: 'Tous les jeux',
  lobby_play_now: 'JOUER MAINTENANT',
  lobby_see_all: 'TOUT VOIR',

  slot_spin: 'TOURNER',
  slot_auto: 'AUTO',
  slot_turbo: 'TURBO',
  slot_bet_amount: 'Mise',
  slot_paytable: 'TABLE DE PAIEMENT',
  slot_no_funds: 'PAS DE FONDS',
  slot_win: 'GAGNÉ!',
  slot_balance: 'Solde',
  slot_last_payout: 'Dernier gain',
  slot_free_spins: 'TOURS GRATUITS',
  slot_free_spins_remaining: 'tours restants',
  slot_lobby: '← LOBBY',

  deposit_title: 'DÉPÔT M-PESA',
  deposit_to: 'Déposer vers',
  deposit_amount: 'Montant (KES)',
  deposit_button: 'DÉPOSER VIA M-PESA',
  deposit_min_max: 'Minimum: KES 10 | Maximum: KES 150 000',
  deposit_verified: 'VÉRIFIÉ',
  deposit_no_phone: 'Aucun numéro M-Pesa enregistré',

  withdraw_title: 'RETRAIT',
  withdraw_available: 'DISPONIBLE',
  withdraw_to: 'Retirer vers',
  withdraw_amount: 'Montant (KES)',
  withdraw_button: 'DEMANDER UN RETRAIT',
  withdraw_min: 'Min',
  withdraw_max: 'Max',
  withdraw_daily: 'Quotidien',
  withdraw_processing: 'Traitement: 1–24 heures · Examen administrateur requis',

  settings_title: 'PARAMÈTRES',
  settings_save: 'ENREGISTRER',
  settings_saved: '✓ ENREGISTRÉ',

  loading: 'CHARGEMENT...',
  cancel: 'ANNULER',
  confirm: 'CONFIRMER',
  close: 'FERMER',
  or: 'OU',
};

export const TRANSLATIONS: Record<Locale, Translations> = { en, sw, fr };
