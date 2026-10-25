import { defineStore } from 'pinia';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, updatePassword, signOut } from 'firebase/auth';
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
      return action === 'Google sign-in'
        ? 'Google sign-in is disabled. Enable the Google provider in Firebase Authentication settings.'
        : 'Email and password sign-up is disabled. Enable it in Firebase Authentication settings.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. Try again when you are ready.';
    case 'auth/unauthorized-domain':
      return 'This website domain is not authorized for Google sign-in. Add it to Firebase Authentication’s authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using another sign-in method. Sign in with that method first.';
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check your internet connection and try again.';
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
    async signInWithGoogle() {
      this.isLoading = true;
      this.error = null;
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(firebaseAuth, provider);
        try {
          await this.setFirebaseUser(credential.user);
        } catch (error) {
          await signOut(firebaseAuth).catch(() => {});
          throw error;
        }
        return { success: true };
      } catch (error) {
        this.error = readableAuthError(error, 'Google sign-in');
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
