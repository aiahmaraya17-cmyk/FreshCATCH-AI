<template>
  <div class="auth-view container container-narrow">
    <div class="glass-card auth-card">
      <div class="auth-header text-center">
        <div class="logo-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-cyan">
            <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z"/>
            <path d="M18 12h.01"/>
            <path d="M2 12c1.5 2 3.5 3.5 6 4"/>
            <path d="M2 12c1.5-2 3.5-3.5 6-4"/>
          </svg>
        </div>
        <h2>Sign In to FreshCatch AI</h2>
        <p class="subtitle">Access scan history, vendor assessments, or researcher tools</p>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage" class="error-alert">
        {{ errorMessage }}
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label>Email Address</label>
          <input 
            v-model="email" 
            type="email" 
            class="input-field" 
            placeholder="you@example.com"
            required 
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <PasswordInput
            v-model="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <div class="forgot-row">
          <button type="button" class="text-link" @click="openResetModal">Forgot password?</button>
        </div>

        <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="isLoading">
          <span v-if="isLoading">Signing in...</span>
          <span v-else>Sign In</span>
        </button>
      </form>

      <div class="auth-footer text-center">
        <span>Don't have an account yet? </span>
        <router-link to="/register" class="text-cyan font-bold">Sign Up</router-link>
      </div>
    </div>

    <div v-if="showResetModal" class="modal-backdrop" @click.self="closeResetModal" @keydown.esc="closeResetModal">
      <section class="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <button type="button" class="modal-close" aria-label="Close" @click="closeResetModal">&times;</button>
        <h3 id="reset-title">Reset your password</h3>
        <p class="subtitle">Enter the email address on your account. Firebase will send a password reset link.</p>
        <div v-if="resetMessage" :class="resetSuccess ? 'success-alert' : 'error-alert'" role="status">
          {{ resetMessage }}
        </div>
        <form class="auth-form" @submit.prevent="handlePasswordReset">
          <div class="form-group">
            <label for="reset-email">Email address</label>
            <input id="reset-email" v-model="resetEmail" class="input-field" type="email" autocomplete="email" required placeholder="you@example.com" />
          </div>
          <button type="submit" class="btn btn-primary w-full" :disabled="resetLoading">
            {{ resetLoading ? 'Sending…' : 'Send reset link' }}
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import PasswordInput from '../../components/common/PasswordInput.vue';
import { useAuthStore } from '../../stores/authStore';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const showResetModal = ref(false);
const resetEmail = ref('');
const resetLoading = ref(false);
const resetMessage = ref('');
const resetSuccess = ref(false);

function openResetModal() {
  resetEmail.value = email.value.trim();
  resetMessage.value = '';
  resetSuccess.value = false;
  showResetModal.value = true;
}

function closeResetModal() {
  showResetModal.value = false;
}

async function handlePasswordReset() {
  resetLoading.value = true;
  resetMessage.value = '';
  resetSuccess.value = false;
  const result = await authStore.sendPasswordReset(resetEmail.value);
  resetLoading.value = false;
  if (result.success) {
    resetSuccess.value = true;
    resetMessage.value = 'If an account exists for that email, Firebase will send a password reset link shortly.';
  } else {
    resetMessage.value = result.code === 'auth/invalid-email'
      ? 'Enter a valid email address.'
      : 'We could not send the reset email. Check your connection and try again.';
  }
}

async function handleLogin() {
  isLoading.value = true;
  errorMessage.value = '';
  const res = await authStore.login(email.value, password.value);
  isLoading.value = false;

  if (res.success) {
    const redirectPath = route.query.redirect || (authStore.isResearcher ? '/admin' : '/dashboard');
    router.push(redirectPath);
  } else {
    errorMessage.value = res.message || 'Invalid email or password';
  }
}
</script>

<style scoped>
.auth-view {
  padding: 4rem 1.25rem;
}

.auth-card {
  max-width: 480px;
  margin: 0 auto;
  padding: 2.5rem 2rem;
}

.logo-wrap {
  margin-bottom: 0.75rem;
}

.auth-header h2 {
  font-size: 1.8rem;
  margin-bottom: 0.35rem;
}

.auth-header .subtitle {
  color: var(--text-muted);
  font-size: 0.88rem;
  margin-bottom: 1.5rem;
}

.error-alert {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-white);
  margin-bottom: 0.35rem;
}

.w-full { width: 100%; }

.forgot-row { display: flex; justify-content: flex-end; margin-top: -0.65rem; }
.text-link { padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-size: 0.85rem; cursor: pointer; }
.text-link:hover { text-decoration: underline; }
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; background: rgba(2, 8, 20, 0.72); }
.reset-modal { position: relative; width: min(100%, 440px); padding: 2rem; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: var(--bg-card, #0d1b2a); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45); }
.reset-modal h3 { margin: 0 2rem 0.5rem 0; color: var(--text-white); }
.reset-modal .subtitle { margin: 0 0 1.25rem; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }
.modal-close { position: absolute; top: 0.75rem; right: 0.9rem; border: 0; background: none; color: var(--text-muted); font-size: 1.7rem; cursor: pointer; }
.success-alert { margin-bottom: 1rem; padding: 0.75rem 1rem; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: var(--radius-sm); background: rgba(34, 197, 94, 0.12); color: #86efac; font-size: 0.85rem; }

.demo-accounts-box {
  background: rgba(0, 0, 0, 0.3);
  border: 1px dashed var(--border-glass);
  padding: 1rem;
  border-radius: var(--radius-sm);
  margin-top: 1.5rem;
}

.demo-title {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-teal);
  margin-bottom: 0.5rem;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.demo-btn {
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  text-align: left;
  transition: all var(--transition-fast);
}

.demo-btn:hover {
  background: var(--primary-glow);
  border-color: var(--primary);
}

.demo-role {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-white);
}

.demo-email {
  font-size: 0.68rem;
  color: var(--text-dim);
}

.auth-footer {
  margin-top: 1.5rem;
  font-size: 0.88rem;
  color: var(--text-muted);
}

.text-cyan { color: var(--primary); }
</style>
