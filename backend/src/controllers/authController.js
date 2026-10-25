const db = require('../config/database');
const { getFirebaseAdmin } = require('../config/firebaseAdmin');

exports.getProfile = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  res.json({ success: true, user: req.user });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required.' });
    const cleanName = name.trim();
    await getFirebaseAdmin().firestore().collection('users').doc(req.firebaseUser.uid).set({ name: cleanName, updatedAt: new Date() }, { merge: true });
    db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cleanName, userId);
    const updatedUser = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId);
    res.json({ success: true, message: 'Profile updated successfully.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed: ' + err.message });
  }
};

const VALID_USER_ROLES = ['consumer', 'vendor', 'admin', 'researcher'];

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function syncFirebaseUser(authUser, profile = {}) {
  const email = normalizeEmail(authUser.email);
  if (!email) return null;
  const role = VALID_USER_ROLES.includes(profile.role) ? profile.role : 'consumer';
  const name = String(profile.name || authUser.displayName || email.split('@')[0]).trim();
  let row = db.prepare('SELECT id FROM users WHERE firebase_uid = ?').get(authUser.uid);
  if (row) {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, email, role, row.id);
  } else {
    row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (row) {
      db.prepare('UPDATE users SET firebase_uid = ?, name = ?, email = ?, role = ?, disabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(authUser.uid, name, email, role, authUser.disabled ? 1 : 0, row.id);
    } else {
      db.prepare('INSERT INTO users (name, email, password, role, firebase_uid, disabled) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, email, '', role, authUser.uid, authUser.disabled ? 1 : 0);
    }
  }
  db.prepare('UPDATE users SET disabled = ?, updated_at = CURRENT_TIMESTAMP WHERE firebase_uid = ?')
    .run(authUser.disabled ? 1 : 0, authUser.uid);
}

async function listAllFirebaseUsers() {
  const admin = getFirebaseAdmin();
  const authUsers = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const profileSnapshot = await admin.firestore().collection('users').get();
  const profiles = new Map(profileSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  const sync = db.transaction((accounts) => {
    for (const authUser of accounts) syncFirebaseUser(authUser, profiles.get(authUser.uid) || {});
  });
  sync(authUsers);

  const activeUids = new Set(authUsers.filter((user) => user.email).map((user) => user.uid));
  const staleAccounts = db.prepare('SELECT id, firebase_uid FROM users WHERE firebase_uid IS NOT NULL').all()
    .filter((user) => !activeUids.has(user.firebase_uid));
  if (staleAccounts.length) {
    const removeStale = db.transaction((accounts) => {
      for (const account of accounts) {
        db.prepare('UPDATE predictions SET user_id = NULL WHERE user_id = ?').run(account.id);
        db.prepare('UPDATE error_analysis_logs SET reviewed_by = NULL WHERE reviewed_by = ?').run(account.id);
        db.prepare('DELETE FROM stalls WHERE owner_id = ?').run(account.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(account.id);
      }
    });
    removeStale(staleAccounts);
  }

  return authUsers
    .filter((user) => user.email)
    .map((user) => db.prepare(`
      SELECT id, name, email, role, created_at, disabled FROM users WHERE firebase_uid = ?
    `).get(user.uid))
    .filter(Boolean)
    .map((user) => ({ ...user, disabled: Boolean(user.disabled) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function adminCount() {
  return db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND firebase_uid IS NOT NULL AND disabled = 0").get().count;
}

exports.listUsers = async (req, res) => {
  try {
    const users = await listAllFirebaseUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving users: ' + err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role || 'consumer';
    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a name and valid email address.' });
    }
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    if (!VALID_USER_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role specified.' });

    const admin = getFirebaseAdmin();
    const authUser = await admin.auth().createUser({ email, password, displayName: name });
    try {
      await admin.firestore().collection('users').doc(authUser.uid).set({
        uid: authUser.uid, name, email, role, active: true, createdAt: new Date(), updatedAt: new Date()
      });
      const result = db.prepare(`
        INSERT INTO users (name, email, password, role, firebase_uid, disabled) VALUES (?, ?, ?, ?, ?, 0)
      `).run(name, email, '', role, authUser.uid);
      const user = db.prepare('SELECT id, name, email, role, created_at, disabled FROM users WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json({ success: true, user, message: 'User account created.' });
    } catch (error) {
      await admin.firestore().collection('users').doc(authUser.uid).delete().catch(() => {});
      await admin.auth().deleteUser(authUser.uid).catch(() => {});
      throw error;
    }
  } catch (err) {
    const status = err.code === 'auth/email-already-exists' ? 409 : 500;
    res.status(status).json({ success: false, message: 'Error creating user: ' + err.message });
  }
};

async function updateManagedUser(req, res) {
  const { id } = req.params;
  const current = db.prepare('SELECT id, firebase_uid, name, email, role, disabled FROM users WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!current.firebase_uid) return res.status(409).json({ success: false, message: 'This account is not linked to Firebase Authentication.' });

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : current.name;
  const email = req.body.email === undefined ? current.email : normalizeEmail(req.body.email);
  const role = req.body.role === undefined ? current.role : req.body.role;
  const admin = getFirebaseAdmin();
  const authUser = await admin.auth().getUser(current.firebase_uid);
  const disabled = req.body.disabled === undefined ? authUser.disabled : req.body.disabled;
  if (typeof disabled !== 'boolean') return res.status(400).json({ success: false, message: 'Account status must be active or deactivated.' });
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter a name and valid email address.' });
  }
  if (!VALID_USER_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role specified.' });
  if (String(req.user.id) === String(id) && role !== 'admin') {
    return res.status(409).json({ success: false, message: 'You cannot remove your own admin access here.' });
  }
  if (String(req.user.id) === String(id) && disabled) {
    return res.status(409).json({ success: false, message: 'You cannot deactivate your signed-in account.' });
  }
  if (current.role === 'admin' && role !== 'admin' && adminCount() <= 1) {
    return res.status(409).json({ success: false, message: 'Keep at least one admin account.' });
  }
  if (current.role === 'admin' && !authUser.disabled && disabled && adminCount() <= 1) {
    return res.status(409).json({ success: false, message: 'Keep at least one active admin account.' });
  }

  const userRef = admin.firestore().collection('users').doc(current.firebase_uid);
  const authChanges = { displayName: name, disabled };
  if (email !== current.email) authChanges.email = email;
  await admin.auth().updateUser(current.firebase_uid, authChanges);
  try {
    if (disabled && !authUser.disabled) await admin.auth().revokeRefreshTokens(current.firebase_uid);
    await userRef.set({ uid: current.firebase_uid, name, email, role, active: !disabled, updatedAt: new Date() }, { merge: true });
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, disabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, email, role, disabled ? 1 : 0, id);
    return res.json({ success: true, message: 'User account updated.' });
  } catch (error) {
    await userRef.set({ uid: current.firebase_uid, name: current.name, email: current.email, role: current.role, active: !authUser.disabled, updatedAt: new Date() }, { merge: true }).catch(() => {});
    await admin.auth().updateUser(current.firebase_uid, { displayName: authUser.displayName || current.name, email: authUser.email || current.email, disabled: authUser.disabled }).catch(() => {});
    throw error;
  }
}

exports.updateUser = async (req, res) => {
  try {
    return await updateManagedUser(req, res);
  } catch (err) {
    const status = ['auth/email-already-exists', 'auth/user-not-found'].includes(err.code) ? 409 : 500;
    res.status(status).json({ success: false, message: 'Error updating user: ' + err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  req.body = { role: req.body.role };
  try {
    return await updateManagedUser(req, res);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating user role: ' + err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT id, firebase_uid, role, disabled FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (!user.firebase_uid) return res.status(409).json({ success: false, message: 'This account is not linked to Firebase Authentication.' });
    if (String(req.user.id) === String(id)) return res.status(409).json({ success: false, message: 'You cannot delete your own account while signed in.' });
    if (user.role === 'admin' && !user.disabled && adminCount() <= 1) return res.status(409).json({ success: false, message: 'Keep at least one active admin account.' });

    const admin = getFirebaseAdmin();
    await admin.auth().deleteUser(user.firebase_uid);
    await admin.firestore().collection('users').doc(user.firebase_uid).delete().catch((error) => {
      console.error('Could not remove deleted user profile from Firestore:', error.message);
    });

    const deleteLocalUser = db.transaction(() => {
      db.prepare('UPDATE predictions SET user_id = NULL WHERE user_id = ?').run(id);
      db.prepare('UPDATE error_analysis_logs SET reviewed_by = NULL WHERE reviewed_by = ?').run(id);
      db.prepare('DELETE FROM stalls WHERE owner_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    deleteLocalUser();
    res.json({ success: true, message: 'User account deleted.' });
  } catch (err) {
    res.status(err.code === 'auth/user-not-found' ? 404 : 500)
      .json({ success: false, message: 'Error deleting user: ' + err.message });
  }
};
