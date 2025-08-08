import jwt from 'jsonwebtoken';
import User from '../models/user.js';

function isEmailInAdminAllowlist(email) {
    const list = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return email && list.includes(email.toLowerCase());
}

export async function auth(req, res, next) {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'No token provided.' });
        }

        const token = authHeader.substring(7);
        
        // First, try to verify as a traditional JWT token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if user exists in our database
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(404).send({ error: 'User not found.' });
            }

            // Promote via allowlist if configured
            if (!user.isAdmin && isEmailInAdminAllowlist(user.email)) {
                try { await User.findByIdAndUpdate(user._id, { isAdmin: true }); } catch {}
                user.isAdmin = true;
            }

            // Attach user info to request
            req.auth = {
                id: user._id,
                email: user.email,
                isAdmin: user.isAdmin || isEmailInAdminAllowlist(user.email)
            };
            
            console.log('Authenticated traditional user:', user.email);
            next();
            return;
        } catch (jwtError) {
            // If JWT verification fails, try Firebase token
            console.log('JWT verification failed, trying Firebase token...');
        }
        
        // Try Firebase token verification (for development)
        try {
            // Try to decode the token payload (this is not secure for production)
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid token format');
            }
            
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            const userEmail = payload.email;
            const displayName = payload.name || payload.display_name || userEmail.split('@')[0];

            if (!userEmail) {
                throw new Error('No email in token');
            }
            
            // Check if user exists in our database
            let user = await User.findOne({ email: userEmail });
            
            if (!user) {
                // Create user if they don't exist (Firebase user registration)
                user = await User.create({
                    email: userEmail,
                    name: displayName, // Add the name from Firebase
                    password: 'firebase-auth-' + Date.now(), // Placeholder password
                    isAdmin: false
                });
                console.log('Created new Firebase user:', userEmail, 'with name:', displayName);
            }

            // Promote via allowlist if configured
            if (!user.isAdmin && isEmailInAdminAllowlist(user.email)) {
                try { await User.findByIdAndUpdate(user._id, { isAdmin: true }); } catch {}
                user.isAdmin = true;
            }

            // Attach user info to request
            req.auth = {
                id: user._id,
                email: user.email,
                isAdmin: user.isAdmin || isEmailInAdminAllowlist(user.email)
            };
            
            console.log('Authenticated Firebase user:', user.email);
            next();
        } catch (firebaseError) {
            console.error('Firebase auth error:', firebaseError);
            // For development, let's try a fallback approach
            if (token.includes('test-token')) {
                const userEmail = 'tyson.williams95@gmail.com'; // Hardcoded for testing
                let user = await User.findOne({ email: userEmail });
                
                if (!user) {
                    user = await User.create({
                        email: userEmail,
                        password: 'firebase-auth-' + Date.now(),
                        isAdmin: false
                    });
                }

                req.auth = {
                    id: user._id,
                    email: user.email,
                    isAdmin: user.isAdmin || isEmailInAdminAllowlist(user.email)
                };
                
                console.log('Authenticated test user:', user.email);
                next();
                return;
            }
            
            return res.status(403).send({ error: 'Invalid or expired token.' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(403).send({ error: 'Authentication failed.' });
    }
}

export function adminOnly(req, res, next) {
    if (!req.auth) {
        return res.status(403).send({ error: 'Unauthorized.'});
    }
    const email = req.auth.email;
    if (req.auth.isAdmin || isEmailInAdminAllowlist(email)) {
        return next();
    }
    User.findOne({ email }).then(user => {
        if (user && user.isAdmin) {
            next();
        } else {
            res.status(403).send({ error: 'Admin access only.'});
        }
    }).catch(() => res.status(403).send({ error: 'Admin access only.'}));
}

export default auth;