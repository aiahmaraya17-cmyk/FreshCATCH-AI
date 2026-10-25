const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRoles } = require('../middleware/authMiddleware');

router.get('/profile', requireAuth, authController.getProfile);
router.put('/profile', requireAuth, authController.updateProfile);

router.get('/users', requireAuth, requireRoles(['admin']), authController.listUsers);
router.post('/users', requireAuth, requireRoles(['admin']), authController.createUser);
router.put('/users/:id', requireAuth, requireRoles(['admin']), authController.updateUser);
router.delete('/users/:id', requireAuth, requireRoles(['admin']), authController.deleteUser);
router.put('/users/:id/role', requireAuth, requireRoles(['admin']), authController.updateUserRole);

module.exports = router;
