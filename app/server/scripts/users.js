// Usage (stop the backend first — it keeps db.json in memory and would overwrite edits):
//   node scripts/users.js list
//   node scripts/users.js reset <username> <newPassword>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

if (!fs.existsSync(DB_FILE)) {
  console.error(`No database at ${DB_FILE}`)
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
const users = db.users || []
const [cmd, username, newPassword] = process.argv.slice(2)

if (cmd === 'list') {
  console.log(`${users.length} user(s) in ${DB_FILE}`)
  for (const u of users) console.log(`  ${JSON.stringify(u.username)}  role=${u.role}  tenant=${u.tenantId ?? '-'}`)
} else if (cmd === 'reset' && username && newPassword) {
  const user = users.find((u) => u.username === username)
  if (!user) {
    console.error(`No user ${JSON.stringify(username)}. Run "list" to see exact usernames.`)
    process.exit(1)
  }
  fs.copyFileSync(DB_FILE, `${DB_FILE}.bak-${Date.now()}`)
  user.passwordHash = hashPassword(newPassword)
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log(`Password reset for ${JSON.stringify(username)} (backup saved next to db.json)`)
} else {
  console.log('Usage: node scripts/users.js list | reset <username> <newPassword>')
  process.exit(1)
}
