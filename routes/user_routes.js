import { Router } from "express";
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import config from '../src/config.js';
import { isDev } from '../src/config.js';
import bcrypt from 'bcrypt';
import User from "../models/user.js";
import Referral from "../models/referral.js"
import jwt from "jsonwebtoken";
import { adminOnly } from "../src/auth.js";
import auth from "../src/auth.js";

const router = Router()

// Health check endpoint
router.get('/health', (req, res) => {
  res.send({ status: 'ok', message: 'User service is running' });
});

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const strictAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register a new user (for traditional email/password registration)
router.post('/register', authLimiter, async (req, res) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).send({ error: 'Invalid request', details: parse.error.flatten() });
    }
    const { name, email, password, referralCode } = parse.data;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).send({ error: "Name, email and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ error: "Email already registered" });
    }

    let referredByUser = null;

    if (referralCode) {
      // Find the user who owns the referral/affiliate code
      referredByUser = await User.findOne({ affiliateCode: referralCode });
      if (!referredByUser) {
        return res.status(400).send({ error: "Invalid referral code" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      referredBy: referredByUser ? referredByUser._id : null,
      referralDate: referredByUser ? new Date() : null,
    });

    res.status(201).send({ 
      message: `Account created: ${newUser.email}`,
      id: newUser._id,
      email: newUser.email,
      name: newUser.name,
      isAdmin: newUser.isAdmin || false
    });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Login a user (for traditional email/password login)
router.post('/login', strictAuthLimiter, async (req, res) => {
    try {
        const parse = loginSchema.safeParse(req.body);
        if (!parse.success) {
          return res.status(400).send({ error: 'Invalid request', details: parse.error.flatten() });
        }
        const { email, password } = parse.data;

        const user = await User.findOne({ email })
        if (isDev) {
          console.log('Backend login - found user:', Boolean(user));
          console.log('Backend login - user has _id:', Boolean(user?._id));
        }
        
        if (user) {
            // Validate the password
            const match = await bcrypt.compare(password || '', user.password )

            if (!match) {
                return res.status(401).send({ error: 'Invalid Credentials'})
            }

            const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin}, config.JWT_SECRET, {
                expiresIn: '30m'
            })

            // Header-only auth: do not set auth cookies; clients must send Authorization: Bearer <token>

            const responseData = {
                token,
                id: user._id,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin,
            };
            // Avoid logging tokens or full user objects in any environment
            if (isDev) {
              console.log('Backend login - sending response for user:', user.email);
            }
            res.send(responseData);

        } else {
            res.status(404).send({ error: 'Email or password incorrect.'})
        }

    } catch (err) {
        console.error('Backend login error:', err);
        res.status(400).send({ error: err.message })
    }
})

// Get current user profile (for Firebase auth)
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.auth.id).select('-password');
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.send(user);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// Update current user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || name.trim().length < 2) {
            return res.status(400).send({ error: 'Name must be at least 2 characters long' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.auth.id,
            { name: name.trim() },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).send({ error: 'User not found' });
        }

        res.send(updatedUser);
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

// Admin Route - Get all users
router.get('/user', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find()
        if (!users) {
            return res.status(404).send({ error: "No users found"})
        }

        const formattedUsers = users.map(user => ({
            userId: user._id,
            email: user.email,
            isAdmin: user.isAdmin || false
        }))
        return res.send(formattedUsers)

    } catch (err) {
        res.status(400).send({ error: `An error occured: ${err.message}`})
    }
})

// Admin route - Update any user
router.put('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const userId = req.params.id
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).send({ error: `User with id ${userId} not found.` })
        }
        const updatedUser = await User.findByIdAndUpdate(userId, req.body, { returnDocument: 'after' })
        res.status(200).send(updatedUser)
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})

// Delete user (admin only)
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const userId = req.params.id
        const deletedUser = await User.findByIdAndDelete(userId)
        if (!deletedUser) {
            return res.status(404).send({ error: "User not found" })
        }
        res.status(200).send({ message: "User deleted successfully" })
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})

// Development endpoint to delete user by email (for testing)
router.delete('/user/delete-by-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({ error: "Email is required" });
        }
        
        const deletedUser = await User.findOneAndDelete({ email });
        if (!deletedUser) {
            return res.status(404).send({ error: "User not found" });
        }
        
        res.status(200).send({ message: "User deleted successfully" });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

// Search users for friend requests
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.auth.id;

    if (!q || q.length < 2) {
      return res.status(400).send({ error: 'Search query must be at least 2 characters' });
    }

    // Search users by name or email, excluding the current user
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name email publicProfile')
    .limit(10);

    res.send({ users });

  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

export default router