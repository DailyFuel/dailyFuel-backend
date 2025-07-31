import { Router } from "express";

const router = Router()

// Get all users
router.get('/user', async (req, res) => {
    try {

    } catch (err) {
        res.status(400).send({ error: `An error occured: ${err.message}`})
    }
})

export default router