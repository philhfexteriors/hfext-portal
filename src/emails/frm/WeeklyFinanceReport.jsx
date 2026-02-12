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
import StatsTable from './components/StatsTable'
import DailyBreakdownTable from './components/DailyBreakdownTable'
import EmailFooter from './components/EmailFooter'

export default function WeeklyFinanceReport({
  weekRange = 'Jan 1 - Jan 7, 2025',
  totalVisitsAllFRMs = 250,
  frmBreakdown = [],
  dailyBreakdownAll = [],
  weekOverWeekChange = { change: 15, percentage: 6 }
}) {
  // Calculate threshold for green (85 visits × number of active FRMs)
  const activeFRMCount = frmBreakdown.length
  const greenThreshold = 85 * activeFRMCount
  const totalColor = totalVisitsAllFRMs >= greenThreshold ? '#22C55E' : '#1F2937'
  const isPositiveChange = weekOverWeekChange.change >= 0

  return (
    <Html>
      <Head />
      <Preview>Company-wide weekly visit summary for {weekRange}</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailHeader
            title="Finance Department - Weekly Report"
            weekRange={weekRange}
          />

          <Section style={contentSection}>
            {/* Executive Summary */}
            <Text style={greeting}>Weekly Performance Summary</Text>
            <Text style={intro}>
              Comprehensive view of all Field Representative Manager activities for the week.
            </Text>

            {/* Large Bold Total Visits */}
            <Section style={totalSection}>
              <Text style={totalLabel}>Company-Wide Total Visits</Text>
              <Text style={{ ...totalNumber, color: totalColor }}>
                {totalVisitsAllFRMs}
              </Text>
              <Text style={subLabel}>
                {activeFRMCount} Active FRM{activeFRMCount !== 1 ? 's' : ''}
              </Text>
              {totalVisitsAllFRMs >= greenThreshold && (
                <Text style={congratsText}>
                  🎉 Team exceeded weekly goal ({greenThreshold} visits)!
                </Text>
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
                  <Text style={comparisonLabel}>Average per FRM</Text>
                  <Text style={comparisonValue}>
                    {activeFRMCount > 0 ? Math.round(totalVisitsAllFRMs / activeFRMCount) : 0} visits
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* FRM Performance Breakdown */}
            <StatsTable frmBreakdown={frmBreakdown} />

            {/* Daily Breakdown Table */}
            <DailyBreakdownTable dailyBreakdown={dailyBreakdownAll} />
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
  fontSize: '20px',
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

const subLabel = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0'
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
