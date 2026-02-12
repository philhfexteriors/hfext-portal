import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Row,
  Column
} from '@react-email/components'
import EmailHeader from './components/EmailHeader'
import DailyBreakdownTable from './components/DailyBreakdownTable'
import EmailFooter from './components/EmailFooter'

export default function WeeklyFRMReport({
  frmName = 'John Doe',
  weekRange = 'Jan 1 - Jan 7, 2025',
  totalVisits = 42,
  dailyBreakdown = [],
  weekOverWeekChange = { change: 5, percentage: 13 },
  ytdVisits = 150
}) {
  // Determine if total visits should be green (>= 85)
  const totalColor = totalVisits >= 85 ? '#22C55E' : '#1F2937'
  const isPositiveChange = weekOverWeekChange.change >= 0

  return (
    <Html>
      <Head />
      <Preview>Your weekly visit summary for {weekRange}</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailHeader
            title="Weekly Visit Report"
            weekRange={weekRange}
          />

          <Section style={contentSection}>
            {/* Greeting */}
            <Text style={greeting}>Hi {frmName},</Text>
            <Text style={intro}>
              Here's your weekly visit summary. Keep up the great work!
            </Text>

            {/* Large Bold Total Visits */}
            <Section style={totalSection}>
              <Text style={totalLabel}>Total Visits This Week</Text>
              <Text style={{ ...totalNumber, color: totalColor }}>
                {totalVisits}
              </Text>
              {totalVisits >= 85 && (
                <Text style={congratsText}>🎉 Excellent work! You hit your weekly goal!</Text>
              )}
            </Section>

            {/* Week-over-Week Comparison */}
            <Section style={comparisonSection}>
              <Row>
                <Column style={comparisonCol}>
                  <Text style={comparisonLabel}>Week-over-Week</Text>
                  <Text style={isPositiveChange ? comparisonPositive : comparisonNegative}>
                    {isPositiveChange ? '↑' : '↓'} {Math.abs(weekOverWeekChange.change)} visits
                    ({isPositiveChange ? '+' : ''}{weekOverWeekChange.percentage}%)
                  </Text>
                </Column>
                <Column style={comparisonCol}>
                  <Text style={comparisonLabel}>Year-to-Date</Text>
                  <Text style={comparisonValue}>{ytdVisits} visits</Text>
                </Column>
              </Row>
            </Section>

            {/* Daily Breakdown Table */}
            <DailyBreakdownTable dailyBreakdown={dailyBreakdown} />
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#F3F4F6',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: '40px 0'
}

const container = {
  backgroundColor: '#FFFFFF',
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
}

const contentSection = {
  padding: '32px 24px'
}

const greeting = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1F2937',
  margin: '0 0 8px 0'
}

const intro = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0 0 24px 0'
}

const totalSection = {
  textAlign: 'center',
  padding: '32px 24px',
  backgroundColor: '#F9FAFB',
  borderRadius: '12px',
  margin: '24px 0',
  border: '2px solid #E5E7EB'
}

const totalLabel = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 8px 0'
}

const totalNumber = {
  fontSize: '72px',
  fontWeight: 'bold',
  lineHeight: '1',
  margin: '0 0 8px 0'
}

const congratsText = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#22C55E',
  margin: '8px 0 0 0'
}

const comparisonSection = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#F9FAFB',
  borderRadius: '8px'
}

const comparisonCol = {
  textAlign: 'center',
  padding: '8px'
}

const comparisonLabel = {
  fontSize: '12px',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 4px 0'
}

const comparisonValue = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#1F2937',
  margin: 0
}

const comparisonPositive = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#22C55E',
  margin: 0
}

const comparisonNegative = {
  fontSize: '20px',
  fontWeight: '600',
  color: '#EF4444',
  margin: 0
}
