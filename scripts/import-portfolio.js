// One-time import script — reads PDFs, DOCX, XLSX from the downloaded portfolio
// and creates .md files in data/portfolio/
//
// Usage: node scripts/import-portfolio.js

const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')
const XLSX = require('xlsx')

const PORTFOLIO_ROOT = path.join(__dirname, '..', 'data', 'portfolio')
const SOURCE_ROOT = 'C:\\Users\\Super\\Downloads\\TWS Portfolio-20260623T191129Z-3-001\\TWS Portfolio'

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function writeMd(dept, title, frontmatter, problem, solution, results, tags, assetNote) {
  const dir = path.join(PORTFOLIO_ROOT, dept)
  fs.mkdirSync(dir, { recursive: true })
  const slug = slugify(title)
  const filepath = path.join(dir, `${slug}.md`)

  const fm = [
    '---',
    `title: "${title}"`,
    `department: ${dept}`,
    `service: "${frontmatter.service || ''}"`,
    `client_niche: "${frontmatter.client_niche || ''}"`,
    `platform: "${frontmatter.platform || 'Upwork'}"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `assets: [${frontmatter.assets.map(a => `"${a}"`).join(', ')}]`,
    `case_study_link: ""`,
    `loom_link: ""`,
    `date_added: "${new Date().toISOString().split('T')[0]}"`,
    '---',
  ].join('\n')

  const body = `\n## Problem\n${problem}\n\n## Solution\n${solution}\n\n## Results\n${results}\n`
  const note = assetNote ? `\n<!-- Source file: ${assetNote} -->\n` : ''

  fs.writeFileSync(filepath, fm + note + body, 'utf-8')
  console.log(`  ✓ Created: ${dept}/${slug}.md`)
}

async function extractPdfText(filepath) {
  const buf = fs.readFileSync(filepath)
  const data = await pdfParse(buf)
  return data.text || ''
}

// ─── MARKETING — Google Ads Case Studies (PDFs) ─────────────────────────────

const GOOGLE_ADS_PDF_META = {
  'Copy of Quick Lock Solutions.pdf':       { title: 'Google Ads — Quick Lock Solutions',        niche: 'Locksmith',             tags: ['google ads', 'locksmith', 'lead gen', 'ppc'] },
  'Copy of AUTO REPAIR Business.pdf':       { title: 'Google Ads — Auto Repair Business',         niche: 'Automotive',            tags: ['google ads', 'auto repair', 'lead gen', 'ppc'] },
  'Copy of Auto Repair Shop.pdf':           { title: 'Google Ads — Auto Repair Shop',             niche: 'Automotive',            tags: ['google ads', 'auto repair', 'ppc'] },
  'Copy of AUTOMOTIVE SERVICES.pdf':        { title: 'Google Ads — Automotive Services',          niche: 'Automotive',            tags: ['google ads', 'automotive', 'ppc', 'lead gen'] },
  'Copy of STC - Call.pdf':                 { title: 'Google Ads — STC Call Campaign',            niche: 'Service Business',      tags: ['google ads', 'call campaign', 'ppc', 'lead gen'] },
  'Copy of Ebiz Filing.pdf':                { title: 'Google Ads — Ebiz Filing',                  niche: 'Legal / Filing Service', tags: ['google ads', 'legal', 'ppc', 'e-commerce'] },
  'Copy of Horizon Realty Real Estate.pdf': { title: 'Google Ads — Horizon Realty',               niche: 'Real Estate',           tags: ['google ads', 'real estate', 'ppc', 'lead gen'] },
  'Copy of Quick Lease.pdf':                { title: 'Google Ads — Quick Lease',                  niche: 'Real Estate / Leasing', tags: ['google ads', 'real estate', 'leasing', 'ppc'] },
  'Copy of 4U Pharmacy.pdf':                { title: 'Google Ads — 4U Pharmacy',                  niche: 'Pharmacy / Healthcare', tags: ['google ads', 'pharmacy', 'healthcare', 'ppc'] },
}

async function importGoogleAdsPdfs() {
  console.log('\n── Marketing / Google Ads Case Studies ──')
  const caseDir = path.join(SOURCE_ROOT, 'Marketing Dept', 'Google Ads', 'Case Studies')

  for (const [file, meta] of Object.entries(GOOGLE_ADS_PDF_META)) {
    const filepath = path.join(caseDir, file)
    if (!fs.existsSync(filepath)) { console.log(`  SKIP (not found): ${file}`); continue }

    let text = ''
    try { text = await extractPdfText(filepath) } catch (e) { console.log(`  WARN: could not parse ${file}: ${e.message}`) }

    // Try to pull meaningful lines — skip very short lines and page numbers
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20)
    const snippet = lines.slice(0, 30).join(' ').slice(0, 600)

    writeMd(
      'marketing',
      meta.title,
      { service: 'Google Ads / PPC', client_niche: meta.niche, platform: 'Upwork', assets: ['case_study'] },
      `${meta.niche} client needed targeted Google Ads campaigns to generate quality leads and improve ROI.`,
      snippet || `Managed full Google Ads campaign for ${meta.niche} client including keyword research, ad copy, bid strategy, and ongoing optimisation.`,
      'Improved lead quality and reduced cost-per-click. See attached case study PDF for full metrics.',
      meta.tags,
      file
    )
  }
}

// ─── MARKETING — Meta Ads (images only, create stub entries) ────────────────

async function importMetaAdsStubs() {
  console.log('\n── Marketing / Meta Ads ──')
  const niches = [
    { title: 'Meta Ads — Gym Campaign',        niche: 'Fitness / Gym',         tags: ['meta ads', 'facebook ads', 'gym', 'fitness', 'lead gen'] },
    { title: 'Meta Ads — Healthcare Campaign', niche: 'Healthcare',             tags: ['meta ads', 'facebook ads', 'healthcare', 'lead gen'] },
    { title: 'Meta Ads — MedSpa Campaign',     niche: 'MedSpa / Beauty',        tags: ['meta ads', 'facebook ads', 'medspa', 'beauty', 'lead gen'] },
    { title: 'Meta Ads — Lead Gen Portfolio',  niche: 'E-commerce / Lead Gen',  tags: ['meta ads', 'facebook ads', 'lead gen', 'e-commerce'] },
  ]
  for (const meta of niches) {
    writeMd(
      'marketing',
      meta.title,
      { service: 'Meta Ads / Facebook Ads', client_niche: meta.niche, platform: 'Upwork', assets: ['images'] },
      `${meta.niche} client needed high-converting Meta/Facebook ad campaigns to drive leads and sales.`,
      'Created ad creatives, copy, audience targeting, and campaign structure. A/B tested ad sets for optimal performance.',
      'Successfully ran campaigns with strong ROAS. Creative assets available as reference images.',
      meta.tags,
      'Meta Ads images folder'
    )
  }
}

// ─── SAAS — HL Case Studies (PDFs) ──────────────────────────────────────────

const SAAS_PDF_META = {
  'Copy of Basement2Finish.pdf':   { title: 'HL Setup — Basement2Finish',    niche: 'Home Improvement / Construction', tags: ['gohighlevel', 'crm', 'automation', 'home improvement', 'saas'] },
  'Copy of Botanical Sciences.pdf':{ title: 'HL Setup — Botanical Sciences', niche: 'Science / E-commerce',            tags: ['gohighlevel', 'crm', 'e-commerce', 'saas', 'automation'] },
  'Copy of Chris Hazzard.pdf':     { title: 'HL Setup — Chris Hazzard',      niche: 'Coaching / Consulting',           tags: ['gohighlevel', 'crm', 'coaching', 'consulting', 'saas'] },
  'Copy of Knowition.pdf':         { title: 'HL Setup — Knowition',          niche: 'Education / SaaS',                tags: ['gohighlevel', 'crm', 'education', 'saas', 'automation'] },
  'Copy of Play4Promo.pdf':        { title: 'HL Setup — Play4Promo',         niche: 'Sports / Promotions',             tags: ['gohighlevel', 'crm', 'sports', 'promotions', 'saas'] },
  'Copy of Still Mags.pdf':        { title: 'HL Setup — Still Mags',         niche: 'Media / Publishing',              tags: ['gohighlevel', 'crm', 'media', 'publishing', 'saas'] },
}

async function importSaasPdfs() {
  console.log('\n── SaaS / HL Case Studies ──')
  const caseDir = path.join(SOURCE_ROOT, 'Saas Dept', 'HL case Studies')

  for (const [file, meta] of Object.entries(SAAS_PDF_META)) {
    const filepath = path.join(caseDir, file)
    if (!fs.existsSync(filepath)) { console.log(`  SKIP (not found): ${file}`); continue }

    let text = ''
    try { text = await extractPdfText(filepath) } catch (e) { console.log(`  WARN: could not parse ${file}: ${e.message}`) }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 20)
    const snippet = lines.slice(0, 30).join(' ').slice(0, 600)

    writeMd(
      'saas',
      meta.title,
      { service: 'GoHighLevel (GHL) Setup & Automation', client_niche: meta.niche, platform: 'Upwork', assets: ['case_study'] },
      `${meta.niche} client needed GoHighLevel CRM setup, automations, and workflow configuration.`,
      snippet || `Full GoHighLevel account setup including pipelines, automations, workflows, and integrations for ${meta.niche} client.`,
      'Delivered fully configured GHL account. Client saw improved lead follow-up and pipeline visibility. See case study PDF.',
      meta.tags,
      file
    )
  }
}

// ─── SAAS — Automations (image stubs) ────────────────────────────────────────

async function importSaasAutomationStubs() {
  console.log('\n── SaaS / Automations ──')
  const automations = [
    { title: 'GHL Workflow Automation',       niche: 'General / SaaS',      tags: ['gohighlevel', 'automation', 'workflow', 'saas', 'crm'] },
    { title: 'AppFolio CRM Automation',       niche: 'Real Estate',         tags: ['appfolio', 'automation', 'real estate', 'crm', 'saas'] },
    { title: 'CloseBot AI Integration',       niche: 'Sales / SaaS',        tags: ['closebot', 'ai', 'automation', 'sales', 'saas'] },
    { title: 'MailParser Data Automation',    niche: 'Data / SaaS',         tags: ['mailparser', 'automation', 'data', 'zapier', 'saas'] },
    { title: 'Zapier Workflow Automation',    niche: 'General / SaaS',      tags: ['zapier', 'automation', 'workflow', 'integration', 'saas'] },
  ]
  for (const meta of automations) {
    writeMd(
      'saas',
      meta.title,
      { service: 'Automation & Workflow Setup', client_niche: meta.niche, platform: 'Upwork', assets: ['images'] },
      `${meta.niche} client needed workflow automation to reduce manual tasks and improve operational efficiency.`,
      'Built automated workflows using GHL / Zapier / MailParser. Configured triggers, actions, and integrations between platforms.',
      'Automated repetitive tasks saving hours of manual work per week. Workflow screenshots available as reference.',
      meta.tags,
      'Automations images folder'
    )
  }
}

// ─── SAAS — A2P + Landing Pages + Real Estate Video ─────────────────────────

async function importSaasExtras() {
  console.log('\n── SaaS / Extras ──')

  // Landing Pages DOCX
  const docxPath = path.join(SOURCE_ROOT, 'Saas Dept', 'Copy of Landing Pages.docx')
  let landingText = ''
  if (fs.existsSync(docxPath)) {
    try {
      const result = await mammoth.extractRawText({ path: docxPath })
      landingText = result.value.trim().slice(0, 600)
    } catch (e) { console.log(`  WARN: could not parse DOCX: ${e.message}`) }
  }

  writeMd(
    'saas',
    'GHL Landing Pages Design',
    { service: 'Landing Page Design & Build (GoHighLevel)', client_niche: 'General / SaaS', platform: 'Upwork', assets: ['case_study'] },
    'Client needed high-converting landing pages built inside GoHighLevel for their lead generation campaigns.',
    landingText || 'Designed and built multiple landing pages within GoHighLevel. Included form integrations, tracking pixels, and mobile optimisation.',
    'Delivered conversion-optimised landing pages integrated with GHL pipelines and automations.',
    ['gohighlevel', 'landing page', 'saas', 'design', 'conversion'],
    'Copy of Landing Pages.docx'
  )

  writeMd(
    'saas',
    'GHL Real Estate Client Setup',
    { service: 'GoHighLevel Full Setup — Real Estate', client_niche: 'Real Estate', platform: 'Upwork', assets: ['loom'] },
    'Real estate client needed complete GoHighLevel CRM setup with lead capture, nurture sequences, and pipeline management.',
    'Full GHL account buildout including pipelines, email/SMS sequences, lead forms, calendar integration, and A2P registration.',
    'Delivered turnkey GHL system. Client had full visibility into lead pipeline from day one. Loom walkthrough available.',
    ['gohighlevel', 'real estate', 'crm', 'saas', 'automation', 'a2p'],
    'Copy of Real Estate Client.mp4'
  )

  writeMd(
    'saas',
    'A2P SMS Verification Setup',
    { service: 'A2P 10DLC Registration & SMS Verification', client_niche: 'General / SaaS', platform: 'Upwork', assets: ['images'] },
    'Client needed A2P 10DLC verification to enable compliant SMS messaging through their GoHighLevel account.',
    'Handled full A2P 10DLC registration process including brand registration, campaign use case setup, and carrier submission.',
    'Successfully verified A2P campaign enabling full SMS outreach. Client can now send compliant SMS at scale.',
    ['a2p', 'sms', 'gohighlevel', 'compliance', 'saas'],
    'Copy of A2P Verification.jpeg'
  )
}

// ─── LOOM RECORDINGS (XLSX) ─────────────────────────────────────────────────

async function importLoomRecordings() {
  console.log('\n── Loom Recordings (XLSX) ──')
  const xlsxPath = path.join(SOURCE_ROOT, 'Loom Recordings.xlsx')
  if (!fs.existsSync(xlsxPath)) { console.log('  SKIP: Loom Recordings.xlsx not found'); return }

  const wb = XLSX.readFile(xlsxPath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)

  console.log(`  Found ${rows.length} rows. Columns: ${Object.keys(rows[0] || {}).join(', ')}`)
  console.log('  Sample row:', JSON.stringify(rows[0]))
  console.log('\n  NOTE: Loom links need to be manually added to existing .md files.')
  console.log('  Run this script again after reviewing the output above to map links.')
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('TWS Portfolio Importer\n')
  console.log(`Source: ${SOURCE_ROOT}`)
  console.log(`Target: ${PORTFOLIO_ROOT}\n`)

  await importGoogleAdsPdfs()
  await importMetaAdsStubs()
  await importSaasPdfs()
  await importSaasAutomationStubs()
  await importSaasExtras()
  await importLoomRecordings()

  console.log('\n✅ Done. Open the Portfolio tab in the app to review entries.')
  console.log('   Add Loom links and Drive links manually from the Portfolio tab.')
}

main().catch(console.error)
