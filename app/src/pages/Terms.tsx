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

export default function Terms() {
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
        <h1 className="sg font-bold mb-2" style={{ fontSize: 'clamp(28px,4vw,36px)', color: T.t1, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        <p className="inter text-sm mb-10" style={{ color: T.t3 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <Section title="1. Acceptance of terms">
          <p>By accessing digitalnovatech.com or purchasing a licence to WhatsApp Portal (the "Software"), you ("you", "Licensee") agree to be bound by these Terms of Service. If you do not agree, do not use the Software or this website.</p>
        </Section>

        <Section title="2. Licence grant">
          <p>Subject to payment of the applicable licence fee, Digital Nova Tech grants you a limited, non-exclusive, non-transferable licence to install and use WhatsApp Portal on your own server infrastructure for your internal business purposes or for managing client accounts, as permitted by your plan tier.</p>
          <p style={{ marginTop: 12 }}>You may not resell, sublicence, or distribute the Software source code as a competing product without a separate written agreement with Digital Nova Tech.</p>
        </Section>

        <Section title="3. Your responsibilities">
          <p>You are solely responsible for:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, listStyleType: 'disc' }}>
            <li>Ensuring your use of WhatsApp Portal complies with WhatsApp's Terms of Service and all applicable laws.</li>
            <li>The content of messages sent through your installation.</li>
            <li>Securing your server, database, and access credentials.</li>
            <li>Obtaining any necessary consents from your end-customers to communicate with them via WhatsApp.</li>
            <li>Compliance with data protection laws (e.g. GDPR, PDPA) in your jurisdiction as the data controller.</li>
          </ul>
        </Section>

        <Section title="4. Prohibited uses">
          <p>You may not use WhatsApp Portal to:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, listStyleType: 'disc' }}>
            <li>Send unsolicited bulk messages (spam) or engage in phishing.</li>
            <li>Violate any applicable law or regulation.</li>
            <li>Infringe third-party intellectual property rights.</li>
            <li>Attempt to reverse engineer or extract the underlying source beyond what an open-source licence permits.</li>
          </ul>
        </Section>

        <Section title="5. Payments and refunds">
          <p>Licence fees are charged as stated on the pricing page at the time of purchase. All fees are exclusive of applicable taxes. Licences are non-refundable except where required by applicable consumer law or at our sole discretion within 7 days of initial purchase if you have not deployed the software.</p>
        </Section>

        <Section title="6. Disclaimer of warranties">
          <p>The Software is provided "as is" without warranty of any kind. Digital Nova Tech does not warrant that the Software is error-free, continuously available, or suitable for any particular purpose. Your use of WhatsApp Portal, including its connection to WhatsApp via unofficial means, is at your own risk.</p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>To the maximum extent permitted by law, Digital Nova Tech's total liability to you for any claim arising out of or in connection with these Terms or the Software shall not exceed the amount you paid for your licence in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.</p>
        </Section>

        <Section title="8. Third-party services">
          <p>WhatsApp Portal integrates with third-party AI providers (Google Gemini, OpenRouter) and WhatsApp. We are not affiliated with, endorsed by, or responsible for these services. Your use of them is subject to their own terms.</p>
        </Section>

        <Section title="9. Termination">
          <p>We may suspend or terminate your licence if you breach these Terms. Upon termination, you must cease using the Software. Sections 6, 7, and 9 survive termination.</p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>We may update these Terms from time to time. Continued use of the Software after a material update constitutes acceptance of the revised Terms. We will notify active licence holders of material changes by email.</p>
        </Section>

        <Section title="11. Governing law">
          <p>These Terms are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.</p>
        </Section>

        <Section title="12. Contact">
          <p>For any questions about these Terms: <a href="mailto:hello@digitalnovatech.com" style={{ color: T.em }}>hello@digitalnovatech.com</a></p>
        </Section>
      </div>

      <footer style={{ borderTop: `1px solid ${T.bl}`, padding: '24px', textAlign: 'center' }}>
        <p className="inter text-xs" style={{ color: T.t3 }}>© {new Date().getFullYear()} Digital Nova Tech. <a href="/privacy" style={{ color: T.em }}>Privacy Policy</a></p>
      </footer>
    </div>
  )
}
