import User from '../models/user.js';

export async function firebaseAuth(req, res, next) {
    try {
        // Extract Firebase ID token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'No Firebase token provided.' });
        }

        const firebaseToken = authHeader.substring(7);
        
        // For development, we'll use a simple approach
        // In production, you should use Firebase Admin SDK to verify tokens
        let userEmail;
        
        try {
            // Try to decode the token payload (this is not secure for production)
            const parts = firebaseToken.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }
            
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            userEmail = payload.email;
            
            if (!userEmail) {
                throw new Error('No email in token');
            }
        } catch (error) {
            console.error('Token decode error:', error);
            // For development, let's try a fallback approach
            // We'll create a simple token format for testing
            if (firebaseToken.includes('test-token')) {
                userEmail = 'tyson.williams95@gmail.com'; // Hardcoded for testing
            } else {
                return res.status(403).send({ error: 'Invalid token format.' });
            }
        }

        // Check if user exists in our database
        let user = await User.findOne({ email: userEmail });
        
        if (!user) {
            // Create user if they don't exist (Firebase user registration)
            user = await User.create({
                email: userEmail,
                password: 'firebase-auth-' + Date.now(), // Placeholder password
                isAdmin: false
            });
            console.log('Created new user:', userEmail);
        }

        // Attach user info to request
        req.auth = {
            id: user._id,
            email: user.email,
            isAdmin: user.isAdmin
        };
        
        console.log('Authenticated user:', user.email);
        next();
    } catch (error) {
        console.error('Firebase auth error:', error);
        return res.status(403).send({ error: 'Invalid or expired token.' });
    }
}

export default firebaseAuth;