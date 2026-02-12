/**
 * OCR Parser Service
 * Extracts and parses text from business card images using Google Cloud Vision API
 */

/**
 * Parse contact information from OCR text
 * Looks for patterns like email, phone, name, title, company
 */
export function parseContactFromOCR(ocrText) {
  if (!ocrText) return null

  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line)

  const contact = {
    name: null,
    email: null,
    phone: null,
    title: null,
    company: null,
    confidence: 'medium'
  }

  // Extract email (high confidence)
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
  for (const line of lines) {
    const emailMatch = line.match(emailPattern)
    if (emailMatch) {
      contact.email = emailMatch[1].toLowerCase()
      break
    }
  }

  // Extract phone (various formats)
  const phonePatterns = [
    /(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/,
    /([0-9]{3}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/,
    /(\([0-9]{3}\)\s*[0-9]{3}[\s.-]?[0-9]{4})/
  ]

  for (const line of lines) {
    for (const pattern of phonePatterns) {
      const phoneMatch = line.match(pattern)
      if (phoneMatch) {
        contact.phone = phoneMatch[1]
        break
      }
    }
    if (contact.phone) break
  }

  // Common job titles to look for
  const titleKeywords = [
    'agent', 'manager', 'director', 'owner', 'president', 'vp', 'ceo', 'cfo',
    'representative', 'rep', 'advisor', 'consultant', 'specialist', 'coordinator',
    'associate', 'executive', 'officer', 'principal', 'partner', 'founder'
  ]

  // Extract title
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    for (const keyword of titleKeywords) {
      if (lowerLine.includes(keyword)) {
        contact.title = line
        break
      }
    }
    if (contact.title) break
  }

  // Extract company name (often has "Insurance" or "Agency" or "Group")
  const companyKeywords = ['insurance', 'agency', 'group', 'associates', 'partners', 'llc', 'inc']
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    for (const keyword of companyKeywords) {
      if (lowerLine.includes(keyword) && !contact.title?.toLowerCase().includes(keyword)) {
        contact.company = line
        break
      }
    }
    if (contact.company) break
  }

  // Extract name (usually first line, or line before title/email)
  // Heuristic: Look for a line with 2-4 words, first letter capitalized, no numbers
  const namePattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/
  for (const line of lines) {
    if (namePattern.test(line)) {
      // Don't use it if it's the company or title
      if (line !== contact.company && line !== contact.title) {
        contact.name = line
        break
      }
    }
  }

  // If no name found yet, try first line that's not email/phone/title/company
  if (!contact.name) {
    for (const line of lines) {
      if (line !== contact.email &&
          line !== contact.phone &&
          line !== contact.title &&
          line !== contact.company &&
          line.length > 2 &&
          line.length < 50 &&
          /[A-Z]/.test(line)) {
        contact.name = line
        break
      }
    }
  }

  // Calculate confidence based on how much data we found
  const fieldsFound = [contact.name, contact.email, contact.phone, contact.title].filter(Boolean).length
  if (fieldsFound >= 3) {
    contact.confidence = 'high'
  } else if (fieldsFound >= 2) {
    contact.confidence = 'medium'
  } else {
    contact.confidence = 'low'
  }

  return contact
}

/**
 * Call Google Cloud Vision API to extract text from image
 * This will be called from the API route, not directly from client
 */
export async function extractTextFromImage(imageBuffer, apiKey) {
  const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`

  const requestBody = {
    requests: [
      {
        image: {
          content: imageBuffer.toString('base64')
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 1
          }
        ]
      }
    ]
  }

  const response = await fetch(visionApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Vision API error: ${error.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()

  if (data.responses && data.responses[0]?.textAnnotations) {
    // First annotation contains all the text
    const extractedText = data.responses[0].textAnnotations[0]?.description || ''
    return extractedText
  }

  return ''
}
