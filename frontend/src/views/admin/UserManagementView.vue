<template>
  <div class="users-admin-view container">
    <header class="page-header users-heading">
      <div>
        <span class="badge badge-cyan">Access Control</span>
        <h1>Manage Users</h1>
        <p class="subtitle">Create, edit, and remove Firebase accounts and assign application roles.</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreate">Add user</button>
    </header>

    <div v-if="notice" class="notice" :class="noticeType" role="status">{{ notice }}</div>

    <div class="glass-card table-card">
      <div v-if="isLoading" class="table-state">Loading users…</div>
      <div v-else-if="users.length === 0" class="table-state">No Firebase accounts found yet.</div>
      <div v-else class="table-scroll">
        <table class="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th class="actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td data-label="User">
                <div class="user-row-info">
                  <div class="mini-avatar">{{ user.name?.charAt(0)?.toUpperCase() || '?' }}</div>
                  <strong>{{ user.name }}</strong>
                  <span v-if="isCurrentUser(user)" class="you-tag">You</span>
                </div>
              </td>
              <td class="email-cell" data-label="Email">{{ user.email }}</td>
              <td data-label="Role"><span class="badge" :class="getRoleBadge(user.role)">{{ user.role }}</span></td>
              <td class="date-cell" data-label="Joined">{{ formatDate(user.created_at) }}</td>
              <td class="row-actions" data-label="Actions">
                <button class="btn btn-secondary btn-sm" type="button" @click="openEdit(user)">Edit</button>
                <button
                  class="btn btn-danger btn-sm"
                  type="button"
                  :disabled="isCurrentUser(user)"
                  :title="isCurrentUser(user) ? 'You cannot delete your signed-in account' : 'Delete account'"
                  @click="removeUser(user)"
                >Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
      <section class="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <button class="modal-close" type="button" aria-label="Close" @click="closeModal">&times;</button>
        <h2 id="user-modal-title">{{ editingId ? 'Edit user' : 'Create user' }}</h2>
        <p class="modal-subtitle">{{ editingId ? 'Update the account details and role.' : 'Create a Firebase Authentication account and profile.' }}</p>

        <div v-if="formError" class="notice error" role="alert">{{ formError }}</div>
        <form class="user-form" @submit.prevent="saveUser">
          <label class="field-label" for="user-name">Full name</label>
          <input id="user-name" v-model.trim="form.name" class="input-field" autocomplete="name" required maxlength="100" />

          <label class="field-label" for="user-email">Email address</label>
          <input id="user-email" v-model.trim="form.email" class="input-field" type="email" autocomplete="email" required />

          <template v-if="!editingId">
            <label class="field-label" for="user-password">Temporary password</label>
            <input id="user-password" v-model="form.password" class="input-field" type="password" autocomplete="new-password" minlength="6" required />
          </template>

          <label class="field-label" for="user-role">Role</label>
          <select id="user-role" v-model="form.role" class="input-field" required :disabled="editingSelf">
            <option value="consumer">Consumer</option>
            <option value="vendor">Vendor</option>
            <option value="researcher">Researcher</option>
            <option value="admin">Admin</option>
          </select>
          <p v-if="editingSelf" class="field-hint">You cannot remove your own admin role.</p>

          <div class="modal-actions">
            <button class="btn btn-secondary" type="button" :disabled="isSaving" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Saving…' : (editingId ? 'Save changes' : 'Create account') }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import ApiService from '../../services/api';

const authStore = useAuthStore();
const users = ref([]);
const isLoading = ref(true);
const isSaving = ref(false);
const modalOpen = ref(false);
const editingId = ref(null);
const formError = ref('');
const notice = ref('');
const noticeType = ref('success');
const form = reactive({ name: '', email: '', password: '', role: 'consumer' });
const editingSelf = computed(() => users.value.find((user) => user.id === editingId.value)?.email === authStore.user?.email);

function isCurrentUser(user) {
  return user.email?.toLowerCase() === authStore.user?.email?.toLowerCase();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getRoleBadge(role) {
  return ({ admin: 'badge-not-fresh', researcher: 'badge-cyan', vendor: 'badge-moderate', consumer: 'badge-fresh' })[role] || 'badge-fresh';
}

async function loadUsers() {
  isLoading.value = true;
  try {
    const response = await ApiService.listUsers();
    users.value = response.users || [];
  } catch (error) {
    noticeType.value = 'error';
    notice.value = error.message || 'Could not load user accounts.';
  } finally {
    isLoading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, { name: '', email: '', password: '', role: 'consumer' });
  formError.value = '';
  modalOpen.value = true;
}

function openEdit(user) {
  editingId.value = user.id;
  Object.assign(form, { name: user.name, email: user.email, password: '', role: user.role });
  formError.value = '';
  modalOpen.value = true;
}

function closeModal() {
  if (isSaving.value) return;
  modalOpen.value = false;
}

async function saveUser() {
  isSaving.value = true;
  formError.value = '';
  try {
    const payload = { name: form.name, email: form.email, role: form.role };
    if (editingId.value) {
      await ApiService.updateManagedUser(editingId.value, payload);
      notice.value = 'User account updated.';
    } else {
      await ApiService.createManagedUser({ ...payload, password: form.password });
      notice.value = 'User account created.';
    }
    noticeType.value = 'success';
    modalOpen.value = false;
    await loadUsers();
  } catch (error) {
    formError.value = error.message || 'Could not save this account.';
  } finally {
    isSaving.value = false;
  }
}

async function removeUser(user) {
  if (isCurrentUser(user)) return;
  if (!window.confirm(`Delete ${user.name} (${user.email})? This permanently removes their Firebase sign-in account.`)) return;
  notice.value = '';
  try {
    await ApiService.deleteManagedUser(user.id);
    noticeType.value = 'success';
    notice.value = 'User account deleted.';
    await loadUsers();
  } catch (error) {
    noticeType.value = 'error';
    notice.value = error.message || 'Could not delete this account.';
  }
}

onMounted(loadUsers);
</script>

<style scoped>
.users-admin-view { padding: 2.5rem 1.25rem 4rem; }
.users-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.75rem; }
.users-heading h1 { margin: 0.5rem 0; }
.subtitle,.modal-subtitle { color: var(--text-muted); }
.table-card { padding: 1.25rem; }
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.users-table { width: 100%; min-width: 740px; border-collapse: collapse; text-align: left; font-size: 0.88rem; }
.users-table th { padding: 0.75rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid var(--border-glass); white-space: nowrap; }
.users-table td { padding: 0.8rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
.user-row-info,.row-actions { display: flex; align-items: center; gap: 0.6rem; }
.user-row-info strong { overflow-wrap: anywhere; }
.mini-avatar { width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 700; background: linear-gradient(135deg,var(--primary),var(--accent-teal)); }
.you-tag { color: var(--text-muted); font-size: 0.72rem; }
.email-cell { overflow-wrap: anywhere; }
.date-cell { white-space: nowrap; color: var(--text-muted); }
.row-actions { justify-content: flex-end; }
.actions-heading { text-align: right; }
.table-state { padding: 2rem 1rem; text-align: center; color: var(--text-muted); }
.notice { margin: 0 0 1rem; padding: 0.8rem 1rem; border-radius: var(--radius-sm); font-size: 0.88rem; }
.notice.success { color: #86efac; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); }
.notice.error { color: #fca5a5; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); }
.modal-backdrop { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 1rem; background: rgba(2,8,20,0.76); }
.user-modal { position: relative; width: min(100%, 480px); max-height: min(90dvh, 760px); overflow-y: auto; padding: 1.75rem; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: #0b1728; box-shadow: var(--shadow-lg); }
.user-modal h2 { margin: 0 2rem 0.35rem 0; font-size: 1.45rem; }
.modal-subtitle { margin: 0 0 1.25rem; font-size: 0.88rem; }
.modal-close { position: absolute; top: 0.7rem; right: 0.8rem; border: 0; background: transparent; color: var(--text-muted); font-size: 1.7rem; cursor: pointer; }
.user-form { display: flex; flex-direction: column; gap: 0.6rem; }
.field-label { margin-top: 0.35rem; color: var(--text-main); font-size: 0.82rem; font-weight: 600; }
.field-hint { margin: 0; color: var(--text-muted); font-size: 0.75rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 1.1rem; }

@media (max-width: 640px) {
  .users-admin-view { padding: 1.5rem 1rem 3rem; }
  .users-heading { align-items: stretch; flex-direction: column; }
  .users-heading h1 { font-size: 1.8rem; }
  .users-heading > .btn { width: 100%; justify-content: center; }
  .table-card { padding: 0.75rem; }
  .user-modal { padding: 1.35rem; }
}
</style>
