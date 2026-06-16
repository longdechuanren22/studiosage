export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, sans-serif', lineHeight: 1.8, color: '#1D1D1F' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#86868B', marginBottom: 32 }}>Last updated: June 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>1. Data We Collect</h2>
      <p>We collect: (a) account information (name, email, password hash); (b) email content you choose to connect via IMAP; (c) client information you create or we auto-detect from emails; (d) invoices, proposals, and messages you create; (e) usage data for service improvement.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>2. How We Use Data</h2>
      <p>Your data is used solely to provide the Service: AI classification, reply generation, client management, invoicing, and related features. We do not sell your data. We do not use your client emails to train AI models. We do not share your data with third parties except as necessary to provide the Service (e.g., Stripe for payments, DeepSeek/Anthropic for AI processing).</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>3. Email Privacy</h2>
      <p>Email passwords are encrypted using AES-256-GCM and stored only for the purpose of maintaining your IMAP connection. You can disconnect your email at any time, which permanently deletes stored credentials. AI processing of emails uses API calls to DeepSeek or Anthropic; email content is transmitted over encrypted connections and is not retained by the AI provider.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>4. Data Storage & Security</h2>
      <p>Data is stored in an encrypted SQLite database. We use bcrypt for password hashing and AES-256-GCM for sensitive field encryption. Communications are encrypted via HTTPS. We implement rate limiting and input validation to protect against abuse.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>5. Data Retention & Deletion</h2>
      <p>Your data is retained for the life of your account. Upon account deletion, data is permanently removed within 30 days. You may request a copy of your data or its deletion by contacting us.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>6. Cookies</h2>
      <p>We use a single localStorage token for authentication. We do not use tracking cookies, analytics cookies, or advertising cookies.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>7. Third-Party Services</h2>
      <p>Our service integrates with: Stripe (payment processing), DeepSeek/Anthropic (AI), Pixieset (gallery), Google (calendar/email OAuth), and your IMAP email provider. Each service has its own privacy policy.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>8. Your Rights</h2>
      <p>You have the right to: access your data, correct inaccurate data, delete your account and data, export your data, and withdraw consent for email processing. To exercise these rights, contact us at the email below.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>9. Contact</h2>
      <p>Data protection inquiries: <a href="mailto:privacy@studiosage.com" style={{ color: '#007AFF' }}>privacy@studiosage.com</a></p>
    </div>
  );
}
