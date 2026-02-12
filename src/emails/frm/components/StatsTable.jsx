import { Section, Row, Column, Text } from '@react-email/components'

export default function StatsTable({ frmBreakdown }) {
  return (
    <Section style={tableSection}>
      <Text style={tableTitle}>FRM Performance Breakdown</Text>

      {/* Table Header */}
      <Row style={headerRow}>
        <Column style={headerCellName}>
          <Text style={headerText}>FRM Name</Text>
        </Column>
        <Column style={headerCellNumber}>
          <Text style={headerText}>Weekly Visits</Text>
        </Column>
      </Row>

      {/* Table Rows */}
      {frmBreakdown.map((frm, index) => (
        <Row key={frm.frmId} style={index % 2 === 0 ? evenRow : oddRow}>
          <Column style={dataCellName}>
            <Text style={dataText}>{frm.frmName}</Text>
          </Column>
          <Column style={dataCellNumber}>
            <Text style={dataTextNumber}>{frm.visitCount}</Text>
          </Column>
        </Row>
      ))}

      {/* Total Row */}
      <Row style={totalRow}>
        <Column style={totalCellName}>
          <Text style={totalText}>Total</Text>
        </Column>
        <Column style={totalCellNumber}>
          <Text style={totalTextNumber}>
            {frmBreakdown.reduce((sum, frm) => sum + frm.visitCount, 0)}
          </Text>
        </Column>
      </Row>
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

const headerCellName = {
  padding: '12px 16px',
  width: '70%'
}

const headerCellNumber = {
  padding: '12px 16px',
  width: '30%',
  textAlign: 'right'
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

const dataCellName = {
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

const totalRow = {
  backgroundColor: '#9D2235',
  borderRadius: '0 0 4px 4px'
}

const totalCellName = {
  padding: '12px 16px'
}

const totalCellNumber = {
  padding: '12px 16px',
  textAlign: 'right'
}

const totalText = {
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: 0
}

const totalTextNumber = {
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: 0
}
