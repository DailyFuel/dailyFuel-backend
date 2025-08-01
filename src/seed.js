import User from '../models/user.js'
import db from './db.js'
import bcrypt from 'bcrypt'

db.connect()

const users = [
    {
        email: 'admin@app.com',
        password: await bcrypt.hash('Password123', 10),
        isAdmin: true
    }
]

// Erase any existing Users
await User.deleteMany()
console.log('Users Erased')

// Creates and saves the new users
const u = await User.create(users)
console.log('Users created.')

db.disconnect()
