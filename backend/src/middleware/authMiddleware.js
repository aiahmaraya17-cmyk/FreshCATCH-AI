const db = require('../config/database');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');

async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) { req.user = null; return next(); }
  try {
    const decoded = await getFirebaseAdmin().auth().verifyIdToken(token, true);
    const firestore = getFirebaseAdmin().firestore();
    const profileRef = firestore.collection('users').doc(decoded.uid);
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    if (profile.active === false) {
      req.user = null;
      return next();
    }
    const validRoles = ['consumer', 'vendor', 'admin', 'researcher'];
    const role = validRoles.includes(profile.role) ? profile.role : 'consumer';
    const name = profile.name || decoded.name || decoded.email?.split('@')[0] || 'FreshCatch User';
    let user = db.prepare('SELECT id, name, email, role, created_at, disabled FROM users WHERE firebase_uid = ?').get(decoded.uid);
    if (!user) {
      const byEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(decoded.email.toLowerCase());
      if (byEmail) {
        db.prepare('UPDATE users SET firebase_uid = ?, name = ?, role = ?, disabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(decoded.uid, name, role, byEmail.id);
      } else {
        db.prepare('INSERT INTO users (name, email, password, role, firebase_uid, disabled) VALUES (?, ?, ?, ?, ?, 0)')
          .run(name, decoded.email.toLowerCase(), '', role, decoded.uid);
      }
    }
    user = db.prepare('SELECT id, name, email, role, created_at, disabled FROM users WHERE firebase_uid = ?').get(decoded.uid);
    if (user && (user.name !== name || user.role !== role || user.disabled !== 0)) {
      db.prepare('UPDATE users SET name = ?, role = ?, disabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, role, user.id);
      user = { ...user, name, role, disabled: 0 };
    }
    req.user = user || null;
    req.firebaseUser = { ...decoded, profileRef };
    return next();
  } catch (error) {
    console.warn('Firebase token verification failed:', error.message);
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  next();
}

function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')} (Current: ${req.user.role})` });
    }
    next();
  };
}

module.exports = { authenticateToken, requireAuth, requireRoles };
