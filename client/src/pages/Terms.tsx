export default function Terms() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, sans-serif', lineHeight: 1.8, color: '#1D1D1F' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#86868B', marginBottom: 32 }}>Last updated: June 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>1. Acceptance of Terms</h2>
      <p>By accessing or using StudioSage ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>2. Description of Service</h2>
      <p>StudioSage is an AI-powered photography studio management platform that provides email integration, client management, proposal and invoice generation, and related tools for professional photographers.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>3. User Accounts</h2>
      <p>You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information when creating an account. You may not share your account with others.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>4. Email Integration</h2>
      <p>By connecting your email account, you grant StudioSage permission to access, read, and process your emails for the purpose of providing the Service. Your email credentials are encrypted at rest using AES-256-GCM. StudioSage does not store your email password in plaintext after the initial connection.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>5. AI-Generated Content</h2>
      <p>StudioSage uses AI to classify messages, generate reply drafts, and create proposals. AI-generated content is provided as a suggestion only. You are responsible for reviewing and approving all content before it is sent to your clients.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>6. Payments & Billing</h2>
      <p>Paid plans are billed monthly or annually. All fees are non-refundable except as required by law. We may change pricing with 30 days notice. Stripe processes all payments; we do not store your payment card details.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>7. Limitation of Liability</h2>
      <p>StudioSage is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service. Our total liability is limited to the amount you paid us in the 12 months preceding the claim.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>8. Termination</h2>
      <p>You may cancel your account at any time. We may suspend or terminate your account for violation of these terms. Upon termination, your data will be retained for 30 days before permanent deletion.</p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>9. Contact</h2>
      <p>Questions about these terms? Contact us at <a href="mailto:legal@studiosage.com" style={{ color: '#007AFF' }}>legal@studiosage.com</a>.</p>
    </div>
  );
}
