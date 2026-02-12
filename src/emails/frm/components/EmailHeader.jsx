import { Section, Text, Heading } from '@react-email/components'

export default function EmailHeader({ title, weekRange }) {
  return (
    <Section style={headerSection}>
      <Heading style={headerTitle}>
        <span style={brandText}>H&F Exteriors</span>
      </Heading>
      <Text style={subtitle}>{title}</Text>
      <Text style={dateRange}>{weekRange}</Text>
    </Section>
  )
}

const headerSection = {
  backgroundColor: '#9D2235',
  padding: '32px 24px',
  textAlign: 'center',
  borderRadius: '8px 8px 0 0'
}

const headerTitle = {
  color: '#FFFFFF',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 8px 0'
}

const brandText = {
  color: '#FFFFFF'
}

const subtitle = {
  color: '#FFFFFF',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px 0'
}

const dateRange = {
  color: '#F3F4F6',
  fontSize: '14px',
  margin: '0'
}
