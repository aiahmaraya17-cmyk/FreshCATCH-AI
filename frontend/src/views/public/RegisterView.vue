<template>
  <div class="auth-view container container-narrow">
    <div class="glass-card auth-card">
      <div class="auth-header text-center">
        <h2>Create FreshCatch AI Account</h2>
        <p class="subtitle">Create an account to save scans and manage your FreshCatch profile</p>
      </div>

      <div v-if="errorMessage" class="error-alert">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label>Full Name</label>
          <input 
            v-model="name" 
            type="text" 
            class="input-field" 
            placeholder="e.g. Maria Santos" 
            required 
          />
        </div>

        <div class="form-group">
          <label>Email Address</label>
          <input 
            v-model="email" 
            type="email" 
            class="input-field" 
            placeholder="e.g. maria@example.com" 
            required 
          />
        </div>

        <div class="form-group">
          <label>Password (min 6 characters)</label>
          <PasswordInput
            v-model="password"
            placeholder="••••••••"
            autocomplete="new-password"
            required
            minlength="6"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-lg w-full" :disabled="isLoading">
          <span v-if="isLoading">Creating account...</span>
          <span v-else>Register Account</span>
        </button>
      </form>

      <div class="auth-divider"><span>or sign up with</span></div>
      <button type="button" class="google-signin-btn" :disabled="isLoading" @click="handleGoogleSignIn">
        <svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/>
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z"/>
          <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.9-5.2Z"/>
          <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.2C14.4 15.5 18.8 12 24 12Z"/>
        </svg>
        <span>{{ isLoading ? 'Connecting to Google…' : 'Continue with Google' }}</span>
      </button>

      <div class="auth-footer text-center">
        <span>Already have an account? </span>
        <router-link to="/login" class="text-cyan font-bold">Sign In</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/authStore';
import PasswordInput from '../../components/common/PasswordInput.vue';

const router = useRouter();
const authStore = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

async function handleRegister() {
  isLoading.value = true;
  errorMessage.value = '';

  const res = await authStore.register(name.value, email.value, password.value);
  isLoading.value = false;

  if (res.success) {
    router.push('/dashboard');
  } else {
    errorMessage.value = res.message || 'Registration failed';
  }
}

async function handleGoogleSignIn() {
  isLoading.value = true;
  errorMessage.value = '';
  const res = await authStore.signInWithGoogle();
  isLoading.value = false;

  if (res.success) {
    router.push(authStore.isResearcher ? '/admin' : '/dashboard');
  } else {
    errorMessage.value = res.message || 'Google sign-in failed. Please try again.';
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

.auth-divider { display: flex; align-items: center; gap: 0.85rem; margin: 1.2rem 0 0.9rem; color: var(--text-dim); font-size: 0.75rem; }
.auth-divider::before, .auth-divider::after { content: ''; height: 1px; flex: 1; background: var(--border-glass); }
.google-signin-btn {
  width: 100%; min-height: 3.1rem; display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  border: 1px solid var(--border-glass); border-radius: var(--radius-sm); background: rgba(255,255,255,0.04);
  color: var(--text-white); font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}
.google-signin-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.08); }
.google-signin-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.google-signin-btn:disabled { opacity: 0.65; cursor: wait; }
.google-mark { width: 1.2rem; height: 1.2rem; flex: 0 0 auto; }

.form-group label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-white);
  margin-bottom: 0.35rem;
}

.w-full { width: 100%; }

.auth-footer {
  margin-top: 1.5rem;
  font-size: 0.88rem;
  color: var(--text-muted);
}

.text-cyan { color: var(--primary); }
</style>
