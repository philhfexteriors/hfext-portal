import { Section, Text, Button, Hr } from '@react-email/components'

export default function EmailFooter({ dashboardUrl = 'https://frm-dashboard.vercel.app' }) {
  return (
    <>
      <Section style={ctaSection}>
        <Button href={dashboardUrl} style={ctaButton}>
          View Full Dashboard
        </Button>
      </Section>

      <Hr style={divider} />

      <Section style={footerSection}>
        <Text style={footerText}>
          H&F Exteriors | Field Representative Manager Dashboard
        </Text>
        <Text style={footerTextSmall}>
          This is an automated weekly report. For questions, contact your manager.
        </Text>
      </Section>
    </>
  )
}

const ctaSection = {
  textAlign: 'center',
  margin: '32px 0'
}

const ctaButton = {
  backgroundColor: '#9D2235',
  color: '#FFFFFF',
  padding: '12px 32px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '16px',
  display: 'inline-block'
}

const divider = {
  borderColor: '#E5E7EB',
  margin: '24px 0'
}

const footerSection = {
  textAlign: 'center',
  padding: '24px 16px'
}

const footerText = {
  color: '#6B7280',
  fontSize: '14px',
  margin: '0 0 8px 0'
}

const footerTextSmall = {
  color: '#9CA3AF',
  fontSize: '12px',
  margin: 0
}
