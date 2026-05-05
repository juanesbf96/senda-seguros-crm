import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '../supabase/schema.sql'), 'utf8')

// Supabase PostgreSQL connection
// The connection string format for Supabase:
// postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
// We don't have the DB password directly - using the API to execute SQL instead

const { Client } = pg

async function applySchema() {
  // Try Supabase direct DB connection via Transaction Pooler (port 6543)
  const connectionString = `postgresql://postgres.tqwkzquchktsjutksjdk:${process.env.DB_PASSWORD || ''}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  if (!process.env.DB_PASSWORD) {
    console.log('❌ DB_PASSWORD not set. Cannot connect directly.')
    console.log('')
    console.log('📋 To apply the schema manually:')
    console.log('   1. Go to: https://supabase.com/dashboard/project/tqwkzquchktsjutksjdk/sql/new')
    console.log('   2. Copy the contents of supabase/schema.sql')
    console.log('   3. Paste and click "Run"')
    process.exit(0)
  }

  const client = new Client({ connectionString })
  try {
    await client.connect()
    console.log('✅ Connected to Supabase PostgreSQL')
    await client.query(sql)
    console.log('✅ Schema applied successfully!')
    await client.end()
  } catch (err) {
    console.error('❌ Error:', err.message)
    await client.end()
  }
}

applySchema()
