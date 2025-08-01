import { Router } from "express";
import bcrypt from 'bcrypt';
import User from "../models/user";
import jwt from "jsonwebtoken";
import { adminOnly, auth } from "../src/auth";

const router = Router()



// Register a new user
router.post('/register', async (req, res) => {
    try {
        const bodyData = req.body

        // Create and save the new User instance
        const user = await User.create({
            email: req.body.email,
            password: await bcrypt.hash(req.body.password, 10)
        })

        // Note: Only sending email, password should not get sent outside of the database
        res.status(201).send({ message: `Account created: ${user.email}`})

    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})

// Login a user
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (user) {
            // Validate the password
            const match = await bcrypt.compare(req.body.password || '', user.password )

            if (!match) {
                return res.status(401).send({ error: 'Invalid Credentials'})
            }

            const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin}, process.env.JWT_SECRET, {
                expiresIn: '1h'
            })

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV == 'production',
                sameSite: 'None',
                maxAge: 1000 * 60 * 60 // 1 hour
            })

            res.send({
                token,
                email: user.email,
                isAdmin: user.isAdmin,
            })

        } else {
            res.status(404).send({ error: 'Email or password incorrect.'})
        }

    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})

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
        res.status(500).send({ error: err.message })
    }
})

export default router