<template>
  <div class="admin-login">
    <h1>{{ t2s('管理後台') }}</h1>
    <p style="color:var(--muted);font-size:13px">{{ t2s('輸入管理員 token 以登入。') }}</p>
    <form @submit.prevent="onSubmit">
      <input
        type="password"
        v-model="token"
        autocomplete="off"
        :placeholder="t2s('Admin Token')"
        required
      />
      <div v-if="err" style="color:#b23;font-size:13px;margin-bottom:8px">{{ err }}</div>
      <button type="submit" :disabled="loading">
        {{ loading ? t2s('登入中…') : t2s('登入') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../../api/suggestions'
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()

const router = useRouter()
const token = ref('')
const loading = ref(false)
const err = ref('')

async function onSubmit() {
  err.value = ''
  loading.value = true
  try {
    await adminApi.login(token.value)
    router.replace('/admin/suggestions')
  } catch (e) {
    err.value = e.message || t2s('登入失敗')
  } finally {
    loading.value = false
  }
}
</script>
