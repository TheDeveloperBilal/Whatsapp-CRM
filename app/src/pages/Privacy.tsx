import { useNavigate } from 'react-router'

const T = { ink: '#0B1120', surf: '#FAFAF8', t1: '#0B1120', t2: '#3C485E', t3: '#7E8FA5', em: '#0C9A68', bl: 'rgba(11,17,32,0.08)' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="sg font-semibold mb-3" style={{ fontSize: 18, color: T.t1 }}>{title}</h2>
      <div className="inter text-sm leading-relaxed" style={{ color: T.t2 }}>{children}</div>
    </section>
  )
}

export default function Privacy() {
  const nav = useNavigate()
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: T.surf, minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${T.bl}`, background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => nav('/')} className="inter font-semibold text-sm cursor-pointer" style={{ color: T.em, background: 'none', border: 'none' }}>
            ← Digital Nova Tech
          </button>
          <span className="inter text-xs" style={{ color: T.t3 }}>Legal</span>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px' }}>
        <p className="inter text-xs font-bold uppercase tracking-widest mb-3" style={{ color: T.em }}>Legal</p>
        <h1 className="sg font-bold mb-2" style={{ fontSize: 'clamp(28px,4vw,36px)', color: T.t1, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
        <p className="inter text-sm mb-10" style={{ color: T.t3 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <Section title="1. Overview">
          <p>Digital Nova Tech ("we", "us", "our") provides WhatsApp Portal, a self-hosted WhatsApp CRM platform. This Privacy Policy explains how we handle information in connection with our website (digitalnovatech.com) and our software.</p>
          <p style={{ marginTop: 12 }}>Because WhatsApp Portal is <strong>self-hosted</strong>, your customer conversation data, contacts, and media files are stored on your own server infrastructure. We do not have access to, and do not process, your end-customer data.</p>
        </Section>

        <Section title="2. Information we collect on this website">
          <p>When you visit digitalnovatech.com we may collect:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, listStyleType: 'disc' }}>
            <li>Standard web server logs (IP address, browser type, referring URL) for security and analytics purposes.</li>
            <li>Email address and any message you send via our contact form, used solely to respond to your enquiry.</li>
            <li>Technical information about visits (pages viewed, session duration) via privacy-respecting analytics.</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do not use advertising trackers, retargeting pixels, or third-party analytics platforms that sell your data.</p>
        </Section>

        <Section title="3. Your WhatsApp Portal data">
          <p>WhatsApp Portal is software you install and run on your own server. All data created through your use of the platform — conversations, contacts, bot configurations, media files — is stored exclusively on your server. We have no access to it.</p>
          <p style={{ marginTop: 12 }}>You are the data controller for all data processed through your installation of WhatsApp Portal. You are responsible for ensuring your use complies with applicable data protection laws (including GDPR, if applicable) and WhatsApp's Terms of Service.</p>
        </Section>

        <Section title="4. How we use information">
          <p>Information collected on this website is used to:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, listStyleType: 'disc' }}>
            <li>Respond to support and sales enquiries.</li>
            <li>Improve the website and documentation.</li>
            <li>Maintain security and prevent abuse.</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do not sell, rent, or trade your personal information with third parties for marketing purposes.</p>
        </Section>

        <Section title="5. Data retention">
          <p>Contact form submissions are retained for up to 12 months, then deleted. Web server logs are retained for up to 90 days for security purposes.</p>
        </Section>

        <Section title="6. Cookies">
          <p>This website uses only essential cookies required for basic site operation (e.g. session management). We do not use cookies for advertising or tracking across other websites.</p>
        </Section>

        <Section title="7. Third-party services">
          <p>We use Google Fonts to render typography. Font requests are made directly from your browser to Google's servers and are subject to Google's privacy policy. No personal data from our site is transmitted in these requests beyond your IP address.</p>
        </Section>

        <Section title="8. Your rights">
          <p>Depending on your jurisdiction, you may have the right to access, correct, or delete personal information we hold about you. To exercise these rights, contact us at <a href="mailto:hello@digitalnovatech.com" style={{ color: T.em }}>hello@digitalnovatech.com</a>.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>We may update this policy from time to time. Material changes will be posted on this page with an updated date. Continued use of the website after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="10. Contact">
          <p>For privacy-related enquiries: <a href="mailto:hello@digitalnovatech.com" style={{ color: T.em }}>hello@digitalnovatech.com</a></p>
        </Section>
      </div>

      <footer style={{ borderTop: `1px solid ${T.bl}`, padding: '24px', textAlign: 'center' }}>
        <p className="inter text-xs" style={{ color: T.t3 }}>© {new Date().getFullYear()} Digital Nova Tech. <a href="/terms" style={{ color: T.em }}>Terms of Service</a></p>
      </footer>
    </div>
  )
}
