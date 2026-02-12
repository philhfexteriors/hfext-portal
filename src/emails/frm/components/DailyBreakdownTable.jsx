import { Section, Row, Column, Text } from '@react-email/components'

export default function DailyBreakdownTable({ dailyBreakdown }) {
  return (
    <Section style={tableSection}>
      <Text style={tableTitle}>Daily Breakdown (Monday - Friday)</Text>

      {/* Table Header */}
      <Row style={headerRow}>
        <Column style={headerCell}>
          <Text style={headerText}>Day</Text>
        </Column>
        <Column style={headerCell}>
          <Text style={headerText}>Visits</Text>
        </Column>
      </Row>

      {/* Table Rows */}
      {dailyBreakdown.map((day, index) => (
        <Row key={day.date} style={index % 2 === 0 ? evenRow : oddRow}>
          <Column style={dataCell}>
            <Text style={dataText}>{day.dayName}</Text>
          </Column>
          <Column style={dataCellNumber}>
            <Text style={dataTextNumber}>{day.visitCount}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

const tableSection = {
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#F9FAFB',
  borderRadius: '8px'
}

const tableTitle = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#1F2937',
  margin: '0 0 16px 0'
}

const headerRow = {
  backgroundColor: '#5B6770',
  borderRadius: '4px 4px 0 0'
}

const headerCell = {
  padding: '12px 16px'
}

const headerText = {
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: '600',
  margin: 0
}

const evenRow = {
  backgroundColor: '#FFFFFF'
}

const oddRow = {
  backgroundColor: '#F3F4F6'
}

const dataCell = {
  padding: '12px 16px',
  borderBottom: '1px solid #E5E7EB'
}

const dataCellNumber = {
  padding: '12px 16px',
  borderBottom: '1px solid #E5E7EB',
  textAlign: 'right'
}

const dataText = {
  color: '#374151',
  fontSize: '14px',
  margin: 0
}

const dataTextNumber = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: '600',
  margin: 0
}
