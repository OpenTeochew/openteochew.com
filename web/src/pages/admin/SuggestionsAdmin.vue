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
        {{ t2s('來源') }}
        <input type="number" min="1" v-model.number="filterSourceId" @change="reload(1)" style="width:64px" :placeholder="t2s('全部')" />
      </label>
    </div>

    <div class="admin-toolbar">
      <label>
        {{ t2s('匯出') }}
        <select v-model="exportSourceId">
          <option :value="null">{{ t2s('全部來源') }}</option>
          <option v-for="n in knownSourceIds" :key="n" :value="n">source {{ n }}</option>
        </select>
      </label>
      <label>
        <input type="checkbox" v-model="exportIncludeCompleted" />
        {{ t2s('含已完成') }}
      </label>
      <a class="export-btn" :href="exportHref">
        {{ t2s('下載 CSV') }}
      </a>
    </div>

    <p v-if="!loading && items.length" class="admin-summary">
      {{ total }} {{ t2s('條') }} · {{ t2s('第') }} {{ page }} / {{ totalPages }} {{ t2s('頁') }}
    </p>

    <div v-if="loading" style="color:var(--muted);padding:20px 0">{{ t2s('載入中…') }}</div>
    <div v-else-if="!items.length" style="color:var(--muted);padding:20px 0">{{ t2s('沒有符合條件的建議') }}</div>
    <div v-else class="sugg-list">
      <div v-for="s in items" :key="s.id" class="sugg-card">
        <div class="sugg-card-head">
          <span class="id">#{{ s.id }}</span>
          <span class="sugg-status" :class="'sugg-status-' + s.status">{{ s.status }}</span>
          <span class="cat">{{ s.category }}</span>
          <span v-if="s.source_id" class="loc">src {{ s.source_id }}<span v-if="s.page_num">·p{{ s.page_num }}</span></span>
          <span class="time">{{ formatTime(s.created_at) }}</span>
          <a v-if="s.url" class="link" :href="s.url" target="_blank" rel="noopener">↗ {{ t2s('原頁') }}</a>
        </div>
        <div class="sugg-body">
          <div v-if="s.selected_text" class="field">
            <span class="field-label">{{ t2s('原文') }}</span>
            <span class="field-val">{{ s.selected_text }}</span>
          </div>
          <div v-if="s.user_note" class="field">
            <span class="field-label">{{ t2s('說明') }}</span>
            <span class="field-val">{{ s.user_note }}</span>
          </div>
          <div v-if="s.email" class="field">
            <span class="field-label">email</span>
            <span class="field-val mono">{{ s.email }}</span>
          </div>
          <div v-if="s.admin_note" class="field">
            <span class="field-label">{{ t2s('備註') }}</span>
            <span class="field-val">{{ s.admin_note }}</span>
          </div>
        </div>
        <div class="sugg-actions">
          <input type="text" v-model="noteInputs[s.id]" :placeholder="t2s('備註（選填）')" />
          <template v-if="s.status === 'pending'">
            <button class="accept" @click="doPatch(s, 'accepted')">✓ {{ t2s('接受') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">✗ {{ t2s('拒絕') }}</button>
          </template>
          <template v-else-if="s.status === 'accepted'">
            <button class="complete" @click="doPatch(s, 'completed')">✓ {{ t2s('完成') }}</button>
            <button class="reject" @click="doPatch(s, 'rejected')">{{ t2s('改拒') }}</button>
          </template>
          <template v-else-if="s.status === 'completed'">
            <button class="undo" @click="doPatch(s, 'accepted')">↶ {{ t2s('取消完成') }}</button>
          </template>
          <template v-else-if="s.status === 'rejected'">
            <button class="undo" @click="doPatch(s, 'pending')">↶ {{ t2s('復原') }}</button>
          </template>
        </div>
      </div>

      <div class="sugg-pager">
        <button :disabled="page <= 1" @click="reload(page - 1)">← {{ t2s('上一頁') }}</button>
        <span>{{ page }} / {{ totalPages }}</span>
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

function formatTime(s) {
  if (!s) return ''
  return String(s).replace(' ', ' ').slice(0, 16)
}

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
