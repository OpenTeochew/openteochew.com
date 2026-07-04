<template>
  <div class="admin-page">
    <h1>{{ t2s('建議審核') }}</h1>

    <div class="admin-toolbar">
      <label>
        {{ t2s('狀態') }}
        <select v-model="filterStatus" @change="reload(1)">
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="completed">completed</option>
          <option value="rejected">rejected</option>
          <option value="all">all</option>
        </select>
      </label>
      <label>
        {{ t2s('類別') }}
        <select v-model="filterCategory" @change="reload(1)">
          <option value="all">all</option>
          <option value="text_revision">text_revision</option>
          <option value="data_contribution">data_contribution</option>
          <option value="feedback">feedback</option>
        </select>
      </label>
      <label>
        {{ t2s('來源 ID') }}
        <input type="number" min="1" v-model.number="filterSourceId" @change="reload(1)" style="width:80px" />
      </label>
    </div>

    <div class="admin-toolbar" style="border-top:1px solid var(--border);padding-top:12px">
      <label>
        {{ t2s('匯出來源') }}
        <select v-model="exportSourceId">
          <option :value="null">{{ t2s('全部') }}</option>
          <option v-for="n in knownSourceIds" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <label>
        <input type="checkbox" v-model="exportIncludeCompleted" />
        {{ t2s('包含已完成') }}
      </label>
      <a class="primary" :href="exportHref" style="text-decoration:none;padding:6px 12px;background:var(--accent);color:#fff;border-radius:4px">
        {{ t2s('匯出 CSV') }}
      </a>
    </div>

    <div v-if="loading" style="color:var(--muted);padding:20px 0">{{ t2s('載入中…') }}</div>
    <div v-else-if="!items.length" style="color:var(--muted);padding:20px 0">{{ t2s('沒有符合條件的建議') }}</div>
    <div v-else>
      <div v-for="s in items" :key="s.id" class="sugg-card">
        <div class="sugg-card-head">
          <span>#{{ s.id }}</span>
          <span class="sugg-status" :class="'sugg-status-' + s.status">{{ s.status }}</span>
          <span>{{ s.category }}</span>
          <span v-if="s.source_id">source {{ s.source_id }}<span v-if="s.page_num">, p.{{ s.page_num }}</span></span>
          <span>{{ s.created_at }}</span>
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" style="margin-left:auto">→ {{ t2s('原頁') }}</a>
        </div>
        <div class="sugg-body">
          <div v-if="s.selected_text" class="field">
            <div class="field-label">{{ t2s('原文片段') }}</div>
            <pre>{{ s.selected_text }}</pre>
          </div>
          <div v-if="s.user_note" class="field">
            <div class="field-label">{{ t2s('補充說明') }}</div>
            <pre>{{ s.user_note }}</pre>
          </div>
          <div v-if="s.email" class="field">
            <div class="field-label">Email</div>
            <span>{{ s.email }}</span>
          </div>
          <div v-if="s.admin_note" class="field">
            <div class="field-label">{{ t2s('審核備註') }}</div>
            <pre>{{ s.admin_note }}</pre>
          </div>
        </div>
        <div class="sugg-actions">
          <input type="text" v-model="noteInputs[s.id]" :placeholder="t2s('備註（可選）')" />
          <template v-if="s.status === 'pending'">
            <button class="accept" @click="doPatch(s, 'accepted')">✓ {{ t2s('接受') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">✗ {{ t2s('拒絕') }}</button>
          </template>
          <template v-else-if="s.status === 'accepted'">
            <button class="complete" @click="doPatch(s, 'completed')">✓ {{ t2s('完成') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">{{ t2s('改為拒絕') }}</button>
          </template>
          <template v-else-if="s.status === 'completed'">
            <button class="undo" @click="doPatch(s, 'accepted')">↶ {{ t2s('取消完成') }}</button>
          </template>
          <template v-else-if="s.status === 'rejected'">
            <button class="undo" @click="doPatch(s, 'pending')">↶ {{ t2s('復原') }}</button>
          </template>
        </div>
      </div>

      <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;color:var(--muted)">
        <button :disabled="page <= 1" @click="reload(page - 1)">← {{ t2s('上一頁') }}</button>
        <span>{{ t2s('第') }} {{ page }} / {{ totalPages }} {{ t2s('頁') }}（{{ total }} {{ t2s('條') }}）</span>
        <button :disabled="page >= totalPages" @click="reload(page + 1)">{{ t2s('下一頁') }} →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminApi } from '../../api/suggestions'
import { useSimplified } from '../../composables/useSimplified'
const { t2s } = useSimplified()

const router = useRouter()

const items = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loading = ref(false)
const noteInputs = ref({})

const filterStatus = ref('pending')
const filterCategory = ref('all')
const filterSourceId = ref(null)

const exportSourceId = ref(null)
const exportIncludeCompleted = ref(false)
const knownSourceIds = ref([1, 2, 3])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const exportHref = computed(() =>
  adminApi.exportUrl(exportSourceId.value || undefined, exportIncludeCompleted.value)
)

async function reload(nextPage = page.value) {
  loading.value = true
  try {
    const data = await adminApi.list({
      status: filterStatus.value,
      category: filterCategory.value,
      source_id: filterSourceId.value || undefined,
      page: nextPage,
      limit: limit.value,
    })
    items.value = data.items
    total.value = data.total
    page.value = nextPage
  } catch (e) {
    if (String(e.message).includes('unauthorized') || String(e.message).includes('401')) {
      router.replace('/admin')
      return
    }
    alert(e.message)
  } finally {
    loading.value = false
  }
}

async function doPatch(s, newStatus) {
  try {
    await adminApi.patch(s.id, {
      status: newStatus,
      admin_note: noteInputs.value[s.id] || undefined,
    })
    noteInputs.value[s.id] = ''
    await reload()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(reload)
</script>
