import { defineStore } from 'pinia';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, updatePassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '../services/firebase';
import { getOrCreateUserProfile, updateUserProfile } from '../services/firebaseUsers';

function readableAuthError(error, action) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'This email already has an account. Sign in or use Forgot password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been deactivated. Contact an administrator to reactivate it.';
    case 'auth/operation-not-allowed':
      return 'Email and password sign-up is disabled. Enable it in Firebase Authentication settings.';
    case 'permission-denied':
      return action === 'register'
        ? 'The account may have been created, but Firestore blocked its profile. Publish the project Firestore rules, then sign in.'
        : 'Firebase blocked access to your profile. Check that the Firestore rules are published.';
    default:
      return error?.message || `Could not ${action}. Please try again.`;
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('freshcatch_token') || null,
    language: localStorage.getItem('freshcatch_lang') || 'en',
    isLoading: false,
    initialized: false,
    error: null
  }),
  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
    isResearcher: (state) => ['researcher', 'admin'].includes(state.user?.role),
    isVendor: (state) => state.user?.role === 'vendor',
    userName: (state) => state.user?.name || 'Guest User',
    userRole: (state) => state.user?.role || 'guest'
  },
  actions: {
    async setFirebaseUser(firebaseUser, displayName = '') {
      if (!firebaseUser) {
        this.user = null;
        this.token = null;
        localStorage.removeItem('freshcatch_token');
        return;
      }
      const [token, profile] = await Promise.all([
        firebaseUser.getIdToken(), getOrCreateUserProfile(firebaseUser, displayName)
      ]);
      this.token = token;
      this.user = { id: firebaseUser.uid, ...profile };
      localStorage.setItem('freshcatch_token', token);
    },
    initialize() {
      if (this._authReady) return this._authReady;
      this._authReady = new Promise((resolve) => {
        onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
          try {
            await this.setFirebaseUser(firebaseUser);
          } catch (error) {
            console.error('Could not load Firebase profile:', error);
            if (error.code === 'permission-denied' || error.code === 'auth/user-disabled') {
              await signOut(firebaseAuth).catch(() => {});
            }
            this.user = null;
            this.token = null;
            localStorage.removeItem('freshcatch_token');
          } finally {
            this.initialized = true;
            this.isLoading = false;
            resolve();
          }
        });
      });
      return this._authReady;
    },
    async login(email, password) {
      this.isLoading = true;
      this.error = null;
      try {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await this.setFirebaseUser(credential.user);
        return { success: true };
      } catch (error) {
        this.error = readableAuthError(error, 'sign in');
        return { success: false, message: this.error };
      } finally { this.isLoading = false; }
    },
    async sendPasswordReset(email) {
      this.isLoading = true;
      this.error = null;
      try {
        await sendPasswordResetEmail(firebaseAuth, email.trim());
        return { success: true };
      } catch (error) {
        this.error = readableAuthError(error, 'send password reset email');
        return { success: false, message: this.error, code: error.code };
      } finally { this.isLoading = false; }
    },
    async register(name, email, password) {
      this.isLoading = true;
      this.error = null;
      try {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await this.setFirebaseUser(credential.user, name.trim());
        return { success: true };
      } catch (error) {
        this.error = readableAuthError(error, 'register');
        return { success: false, message: this.error, code: error.code };
      } finally { this.isLoading = false; }
    },
    async updateProfile(name, password) {
      const firebaseUser = firebaseAuth.currentUser;
      if (!firebaseUser) return { success: false, message: 'Please sign in again.' };
      try {
        if (name.trim() !== firebaseUser.displayName) await updateProfile(firebaseUser, { displayName: name.trim() });
        if (password) await updatePassword(firebaseUser, password);
        const profile = await updateUserProfile(firebaseUser, { name: name.trim() });
        this.user = { ...this.user, ...profile, name: name.trim() };
        return { success: true };
      } catch (error) { return { success: false, message: error.message }; }
    },
    async logout() {
      await signOut(firebaseAuth);
      this.user = null;
      this.token = null;
      localStorage.removeItem('freshcatch_token');
    },
    setLanguage(lang) {
      this.language = lang;
      localStorage.setItem('freshcatch_lang', lang);
    }
  }
});
