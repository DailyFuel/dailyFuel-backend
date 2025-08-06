import { Router } from "express";
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

// Register a new user (for traditional email/password registration)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

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
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        console.log('Backend login - Found user:', user);
        console.log('Backend login - user._id:', user?._id);
        console.log('Backend login - user._id type:', typeof user?._id);
        
        if (user) {
            // Validate the password
            const match = await bcrypt.compare(req.body.password || '', user.password )

            if (!match) {
                return res.status(401).send({ error: 'Invalid Credentials'})
            }

            const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin}, process.env.JWT_SECRET, {
                expiresIn: '30m'
            })

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV == 'production',
                sameSite: 'None',
                maxAge: 1000 * 60 * 30 // 30 min
            })

            const responseData = {
                token,
                id: user._id,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin,
            };
            
            console.log('Backend login - Sending response:', responseData);
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

export default router