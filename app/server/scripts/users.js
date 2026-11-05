// Usage (stop the backend before "reset" — it keeps db.json in memory and would overwrite edits):
//   node scripts/users.js list
//   node scripts/users.js check <username>
//   node scripts/users.js reset <username> [newPassword]   (or pass NEW_PASSWORD env var)
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
const [cmd, username, argPassword] = process.argv.slice(2)
const newPassword = argPassword || process.env.NEW_PASSWORD

if (cmd === 'list') {
  console.log(`${users.length} user(s) in ${DB_FILE}`)
  for (const u of users) console.log(`  ${JSON.stringify(u.username)}  role=${u.role}  tenant=${u.tenantId ?? '-'}`)
} else if (cmd === 'check' && username) {
  // Output is safe for public CI logs: no other usernames are revealed.
  console.log(`${users.length} user(s) in database`)
  const exact = users.find((u) => u.username === username)
  if (exact) {
    console.log(`"${username}" exists (role=${exact.role}). If login still fails, the password is wrong — use reset.`)
  } else {
    const loose = users.find((u) => u.username.trim().toLowerCase() === username.trim().toLowerCase())
    console.log(loose
      ? `"${username}" not found exactly, but a user differs only by letter case or spaces — usernames are case-sensitive.`
      : `"${username}" does not exist.`)
    process.exit(1)
  }
} else if (cmd === 'reset' && username && newPassword) {
  const user = users.find((u) => u.username === username)
  if (!user) {
    console.error(`No user "${username}". Run "check" to diagnose.`)
    process.exit(1)
  }
  fs.copyFileSync(DB_FILE, `${DB_FILE}.bak-${Date.now()}`)
  user.passwordHash = hashPassword(newPassword)
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log(`Password reset for "${username}" (backup saved next to db.json)`)
} else {
  console.log('Usage: node scripts/users.js list | check <username> | reset <username> [newPassword]')
  process.exit(1)
}
