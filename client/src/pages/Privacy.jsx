// Plain-language privacy notice (PDPA: notification + purpose + retention + your rights).
// TODO before launch: put your team's real contact email below and have it reviewed.
import { PageHead } from '../components/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

const CONTACT_EMAIL = 'your-team@email.com'; // ← replace with your team's email (your Data Protection Officer)

const SECTIONS = [
  ['What we collect', [
    'Your name, a username and a password (stored scrambled, never readable).',
    'Who is in your Safety Circle, and the asks and replies you send each other.',
    'Scam reports and comments you choose to post.',
    'Your settings: language, app style and notification choices.',
  ]],
  ['What we never keep', [
    'The messages you check. We only keep the risk score, so your family’s weekly summary works.',
    'Call audio. Live Call Guard turns speech into text on your phone, and we don’t save the text.',
    'NRIC, card, bank account numbers and OTP codes. They are removed automatically before anything is saved.',
    'Your family code word. Agree it in person; it never touches the app.',
  ]],
  ['Why we use it', [
    'To warn you about scams, to let your Safety Circle help you, and to share verified scam alerts with the community.',
    'We don’t sell your data or use it for advertising.',
  ]],
  ['How long we keep it', [
    'Text of family asks: wiped after 30 days.',
    'Notifications and check scores: deleted after 90 days.',
    'Everything else: until you delete your account.',
  ]],
  ['Who can see it', [
    'Only people in your Safety Circle see your asks, your block list and your weekly summary.',
    'Community reports are public after a moderator checks them. Your username is shown, your other details are not.',
  ]],
  ['Your choices', [
    'Download everything we hold about you from Profile → Privacy.',
    'Delete your account at any time. This removes your reports, comments and family asks.',
    'Children under 13 need a parent or guardian to set up the account with them.',
  ]],
];

export default function Privacy() {
  const { t } = useI18n();
  return (
    <main className="page privacy">
      <PageHead title={t('privacy.notice')} back />
      {SECTIONS.map(([h, items]) => (
        <section key={h} className="panel">
          <h2>{h}</h2>
          <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <p className="muted small">Questions or requests: {CONTACT_EMAIL}. KakiGuard is a hackathon prototype; this notice describes how the prototype is built.</p>
    </main>
  );
}
