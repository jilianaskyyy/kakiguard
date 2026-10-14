// Demo data so the app looks alive on first launch.
// All demo accounts use the password: demo123
import bcrypt from 'bcryptjs';
import { analyse } from '../shared/scamEngine.js';

export function seed(db) {
  const hash = bcrypt.hashSync('demo123', 8);
  const addUser = db.prepare("INSERT INTO users (name, username, password_hash, role, lang, points, color, ui_mode, consent_at) VALUES (?,?,?,?,?,?,?,?, datetime('now'))");
  const U = {};
  [
    ['Jiliana', 'jiliana', 'user', 'en', 120, '#2F6BFF'],
    ['Mum', 'mum', 'user', 'zh', 40, '#E85D75'],
    ['Dad', 'dad', 'user', 'en', 25, '#1E9E6A'],
    ['Ethan', 'ethan', 'user', 'en', 80, '#F29B1D'],
    ['Moderator Mei', 'mod', 'moderator', 'en', 300, '#7A4DFF'],
    ['Aunty Rose', 'rose', 'user', 'en', 60, '#C2410C'],
    ['Kumar', 'kumar', 'user', 'ta', 45, '#0E7490'],
    ['Nurul', 'nurul', 'user', 'ms', 55, '#9333EA'],
  ].forEach(([name, username, role, lang, points, color]) => {
    // Mum and Dad use Simple mode (big buttons); everyone else uses Full mode
    U[username] = addUser.run(name, username, hash, role, lang, points, color, ['mum', 'dad'].includes(username) ? 'simple' : 'full').lastInsertRowid;
  });

  // Family circle
  const circleId = db.prepare('INSERT INTO circles (name, owner_id, invite_code) VALUES (?,?,?)')
    .run("Jiliana's Family", U.jiliana, 'FAM123').lastInsertRowid;
  const addMember = db.prepare('INSERT INTO circle_members (circle_id, user_id, relation) VALUES (?,?,?)');
  addMember.run(circleId, U.jiliana, null);
  addMember.run(circleId, U.mum, 'Mum');
  addMember.run(circleId, U.dad, 'Dad');
  addMember.run(circleId, U.ethan, 'Brother');

  // Community reports
  const addReport = db.prepare(`INSERT INTO reports
    (user_id, title, content, platform, scam_type, asked_to, lost_money, risk_score, ai_flags, status, reviewed_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now', ?))`);
  const reports = [
    [U.rose, 'Fake DBS "account suspended" SMS',
      'DBS: Your account has been suspended due to unusual activity. Verify immediately at dbs-sg-secure.com/verify to avoid permanent closure.',
      'sms', 'bank', ['click_link', 'give_info'], 'no', 'verified', '-12 minutes'],
    [U.kumar, 'SingPost parcel "redelivery fee"',
      'SingPost: Your parcel is held at our warehouse due to incomplete address. Pay $1.99 redelivery fee within 24 hours: singpost-redeliver.top/sg',
      'sms', 'delivery', ['click_link', 'pay'], 'no', 'verified', '-2 hours'],
    [U.nurul, 'Telegram job: earn $300/day liking videos',
      'Hi! We are hiring part-time staff. Earn $300 per day just like videos on YouTube. No experience needed. Add me on Telegram t.me/hr_sg_jobs to start. Small deposit required to unlock tasks.',
      'telegram', 'job', ['pay', 'move_platform'], 'yes', 'verified', '-5 hours'],
    [U.rose, 'Caller pretending to be ICA then "police"',
      'Caller said he is from ICA, my passport was used in a money laundering case. Transferred me to a "police officer" who said I will be arrested unless I transfer my savings to a safe account. Told me don\'t tell anyone, it is a confidential investigation.',
      'call', 'gov', ['transfer_money', 'keep_secret'], 'no', 'verified', '-1 day'],
    [U.kumar, 'Carousell buyer sends fake "payment link"',
      'Buyer on Carousell said he already paid and I must click this link to receive the money: carousell-sg-pay.xyz/receive . It asked for my card number and OTP.',
      'social', 'ecommerce', ['click_link', 'give_otp'], 'no', 'verified', '-1 day'],
    [U.nurul, 'WhatsApp "investment group" with guaranteed returns',
      'You have been added to VIP Stock Tips SG. Our analyst guarantees high returns of 30% weekly. Deposit USDT to start investing today only!',
      'whatsapp', 'investment', ['transfer_money'], 'skip', 'verified', '-2 days'],
    [U.rose, 'Singpass "account suspended" email',
      'Your Singpass account will be suspended within 24 hours. Click bit.ly/singpass-renew to update your particulars and enter your Singpass password.',
      'email', 'phishing', ['click_link', 'give_info'], 'no', 'verified', '-3 days'],
    [U.kumar, '"Hi Mum, this is my new number"',
      'Hi Mum, I dropped my phone, this is my new number. Can you help me PayNow $800 urgently? I will return tomorrow. Don\'t tell Dad first ok',
      'whatsapp', 'other', ['transfer_money', 'keep_secret'], 'no', 'verified', '-4 days'],
    // pending (for the moderator demo)
    [U.nurul, 'IRAS tax refund SMS?',
      'IRAS: You are eligible for a tax refund of $520.40. Claim now at iras-refund-sg.click before it expires.',
      'sms', 'gov', ['click_link'], 'no', 'pending', '-8 minutes'],
    [U.rose, 'Is this Shopee voucher real?',
      'Congratulations! You have won a $200 Shopee voucher in our lucky draw. Claim your prize at shopee-luckydraw.vip',
      'sms', 'ecommerce', ['click_link'], 'no', 'pending', '-30 minutes'],
  ];
  const ids = reports.map(([uid, title, content, platform, type, asked, lost, status, ago]) => {
    const r = analyse(content);
    return addReport.run(uid, title, content, platform, type, JSON.stringify(asked), lost, r.score,
      JSON.stringify(r.flags.map((f) => f.flag)), status, status === 'verified' ? U.mod : null, ago).lastInsertRowid;
  });

  const addComment = db.prepare("INSERT INTO comments (report_id, user_id, content, created_at) VALUES (?,?,?, datetime('now', ?))");
  addComment.run(ids[0], U.kumar, 'Got the exact same SMS this morning. The link is not dbs.com.sg!', '-10 minutes');
  addComment.run(ids[0], U.nurul, 'DBS will never send you a link by SMS. Please tell your parents.', '-6 minutes');
  addComment.run(ids[1], U.rose, 'I almost paid… thank you for posting this.', '-1 hours');
  addComment.run(ids[2], U.kumar, 'My friend lost $2,000 to this. First they pay you small amounts to gain trust.', '-4 hours');
  addComment.run(ids[3], U.nurul, 'Real police will NEVER ask you to transfer money. Hang up and call 1799.', '-20 hours');
  addComment.run(ids[7], U.rose, 'My neighbour got this too. Always call your child on the OLD number first.', '-3 days');

  // "I got this too" counters
  const seen = db.prepare('INSERT OR IGNORE INTO seen_too (report_id, user_id) VALUES (?,?)');
  const people = Object.values(U);
  [[0, 7], [1, 6], [2, 5], [3, 4], [4, 3], [5, 4], [6, 5], [7, 6]].forEach(([i, n]) => {
    people.slice(0, n).forEach((uid) => seen.run(ids[i], uid));
  });

  // Shared family block list (demo numbers)
  const addBlock = db.prepare('INSERT INTO circle_blocks (circle_id, number, label, added_by, created_at) VALUES (?,?,?,?, datetime(\'now\', ?))');
  addBlock.run(circleId, '87650001', 'Fake "ICA officer" caller', U.dad, '-2 days');
  addBlock.run(circleId, '96660123', 'Telegram job scam', U.ethan, '-5 days');

  // Notification settings. Jiliana's asks go to Mum first; Dad has quiet hours on.
  const addSettings = db.prepare('INSERT INTO notify_settings (user_id, receive, quiet_on, ask_mode, main_kaki_id, call_alert) VALUES (?,?,?,?,?,?)');
  addSettings.run(U.jiliana, 'family', 0, 'main_first', U.mum, 'auto');
  addSettings.run(U.mum, 'family', 0, 'main_first', U.jiliana, 'auto');
  addSettings.run(U.dad, 'family', 1, 'main_first', U.jiliana, 'auto');
  addSettings.run(U.ethan, 'urgent', 0, 'circle', null, 'auto');

  // A week of quiet checks, for the weekly family summary
  const addCheck = db.prepare("INSERT INTO checks (user_id, score, level, top_flag, created_at) VALUES (?,?,?,?, datetime('now', ?))");
  [[U.mum, 92, 'high', 'link_lookalike', '-1 day'], [U.mum, 85, 'high', 'gov_impersonation', '-3 days'], [U.mum, 20, 'low', null, '-4 days'],
    [U.mum, 70, 'high', 'link_lookalike', '-5 days'], [U.dad, 45, 'medium', 'easy_money', '-2 days'],
    [U.ethan, 88, 'high', 'delivery_fee', '-1 day'], [U.jiliana, 90, 'high', 'link_lookalike', '-2 days']]
    .forEach((c) => addCheck.run(...c));

  // Jiliana's inbox
  const addNotif = db.prepare("INSERT INTO notifications (user_id, type, level, actor_id, ref_id, body, pushed, read, created_at) VALUES (?,?,?,?,?,?,?,?, datetime('now', ?))");
  addNotif.run(U.jiliana, 'community', 'info', null, ids[0], reports[0][1], 0, 0, '-12 minutes');
  addNotif.run(U.jiliana, 'reply', 'family', U.dad, null, 'scam', 1, 1, '-1 day');
  addNotif.run(U.jiliana, 'community', 'info', null, ids[1], reports[1][1], 0, 1, '-2 hours');
  addNotif.run(U.jiliana, 'report', 'info', null, ids[2], reports[2][1], 0, 1, '-5 hours');

  // Scam or Safe? cards
  const addQuiz = db.prepare('INSERT INTO quiz_items (sender, channel, message, is_scam, flags, safe_why) VALUES (?,?,?,?,?,?)');
  [
    ['+65 8123 4567', 'sms', 'Congratulations! You have won a $500 NTUC voucher. Claim now at ntuc-rewards.vip before midnight!', 1, ['prize', 'urgency', 'link_risky'], null],
    ['DBS', 'sms', 'Your DBS PayLah! transfer of $25.00 to ETHAN TAN was successful on 01 Oct.', 0, [], 'safe_no_action'],
    ['Unknown', 'whatsapp', 'Hi Mum, I lost my phone. This is my new number. Can you PayNow me $600 urgently? Don\'t tell Dad.', 1, ['money_transfer', 'urgency', 'secrecy'], null],
    ['HR Recruiter', 'telegram', 'Part-time job! Earn $250/day by liking hotel reviews. No experience. Pay $50 to unlock premium tasks.', 1, ['easy_money', 'money_transfer'], null],
    ['SingPost', 'sms', 'Your parcel is waiting. Pay $2.10 customs fee within 24hrs: bit.ly/sgpost-fee', 1, ['delivery_fee', 'link_shortened', 'urgency'], null],
    ['Polyclinic', 'sms', 'Reminder: Your appointment is on 3 Oct, 9:30am at Woodlands Polyclinic. Reply Y to confirm.', 0, [], 'safe_known_event'],
    ['"Police officer"', 'call', 'This is Inspector Lim from SPF. Your bank account is linked to money laundering. Transfer your savings to a safe account now. Stay on the line and do not tell anyone.', 1, ['gov_impersonation', 'threat', 'money_transfer', 'secrecy'], null],
    ['Grab', 'email', 'Here is your receipt for your GrabFood order of $18.40. Thanks for ordering!', 0, [], 'safe_no_action'],
    ['IT Support', 'call', 'Your computer has a virus. Please install AnyDesk so I can fix it remotely and verify your bank login.', 1, ['remote_access', 'personal_info'], null],
    ['Carousell buyer', 'whatsapp', 'I already paid. Click carousell-pay.xyz/receive and enter your card number and OTP to receive the money.', 1, ['otp_request', 'personal_info', 'link_lookalike'], null],
  ].forEach(([sender, ch, msg, scam, flags, why]) => addQuiz.run(sender, ch, msg, scam, JSON.stringify(flags), why));
}
