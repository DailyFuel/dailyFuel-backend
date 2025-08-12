import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import config, { isDev } from './config.js';

function isEmailInAdminAllowlist(email) {
    const list = (config.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
    return Boolean(email) && list.includes(String(email).toLowerCase());
}

export async function auth(req, res, next) {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'No token provided.' });
        }

        const token = authHeader.substring(7);
        
        // First, try to verify as a traditional JWT token (required in production)
        try {
            const decoded = jwt.verify(token, config.JWT_SECRET);
            
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
            if (!isDev) {
                return res.status(403).send({ error: 'Invalid or expired token.' });
            }
            if (isDev) {
                console.log('JWT verification failed in dev, trying Firebase token...');
            }
        }
        
        // Try Firebase token verification (development only, unsigned decode)
        if (isDev) {
            try {
                const parts = token.split('.');
                if (parts.length !== 3) {
                    throw new Error('Invalid token format');
                }
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                const userEmail = payload.email;
                const displayName = payload.name || payload.display_name || (userEmail ? userEmail.split('@')[0] : '');

                if (!userEmail) {
                    throw new Error('No email in token');
                }

                let user = await User.findOne({ email: userEmail });
                if (!user) {
                    user = await User.create({
                        email: userEmail,
                        name: displayName,
                        authProvider: 'firebase',
                        isAdmin: false
                    });
                    console.log('Created new Firebase user (dev):', userEmail, 'with name:', displayName);
                }

                if (!user.isAdmin && isEmailInAdminAllowlist(user.email)) {
                    try { await User.findByIdAndUpdate(user._id, { isAdmin: true }); } catch {}
                    user.isAdmin = true;
                }

                req.auth = {
                    id: user._id,
                    email: user.email,
                    isAdmin: user.isAdmin || isEmailInAdminAllowlist(user.email)
                };

                console.log('Authenticated Firebase user (dev):', user.email);
                next();
                return;
            } catch (firebaseError) {
                console.error('Firebase auth error (dev):', firebaseError);
                // Development-only testing token fallback
                if (isDev && token.includes('test-token')) {
                    const userEmail = 'tyson.williams95@gmail.com';
                    let user = await User.findOne({ email: userEmail });
                    if (!user) {
                        user = await User.create({
                            email: userEmail,
                            authProvider: 'firebase',
                            isAdmin: false
                        });
                    }
                    req.auth = {
                        id: user._id,
                        email: user.email,
                        isAdmin: user.isAdmin || isEmailInAdminAllowlist(user.email)
                    };
                    console.log('Authenticated test user (dev):', user.email);
                    next();
                    return;
                }
            }
        }

        return res.status(403).send({ error: 'Invalid or expired token.' });
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