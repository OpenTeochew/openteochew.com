<script setup>
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 720px;">
        <div class="about-hero">
          <h1>{{ t2s('隱私條款') }}</h1>
          <p class="lead">{{ t2s('OpenTeochew 是一個非營利的潮州話語言資源平台。我們高度重視您的隱私，以下說明我們如何處理數據。') }}</p>
        </div>
        <div class="about-section">
          <h2>{{ t2s('我們不收集什麼') }}</h2>
          <ul class="about-list">
            <li><strong>{{ t2s('不需要註冊帳號') }}</strong><p>{{ t2s('本站無需註冊或登入即可使用全部功能。') }}</p></li>
            <li><strong>{{ t2s('不使用追蹤 Cookie') }}</strong><p>{{ t2s('我們不使用廣告追蹤或行為分析 Cookie。') }}</p></li>
            <li><strong>{{ t2s('不出售您的數據') }}</strong><p>{{ t2s('我們不會將任何用戶數據出售或分享給第三方。') }}</p></li>
          </ul>
        </div>
        <div class="about-section">
          <h2>{{ t2s('自動收集的資訊') }}</h2>
          <p>{{ t2s('當您訪問本站時，我們的託管服務商 Cloudflare 可能會自動記錄標準的伺服器日誌資訊，包括 IP 位址、訪問時間、瀏覽器類型和請求的頁面。這些資訊僅用於維護網站安全和穩定運行，不與任何個人身份關聯。') }}</p>
        </div>
        <div class="about-section">
          <h2>{{ t2s('本地存儲') }}</h2>
          <p>{{ t2s('本站使用瀏覽器本地存儲（localStorage）保存您的語言偏好（繁體/簡體切換）。這些數據僅存儲在您的瀏覽器中，不會上傳到伺服器。') }}</p>
        </div>
        <div class="about-section">
          <h2>{{ t2s('第三方服務') }}</h2>
          <ul class="about-list">
            <li><strong>Cloudflare</strong><p>{{ t2s('提供網站託管與內容分發（CDN）服務。詳見') }}<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare {{ t2s('隱私政策') }}</a>。</p></li>
          </ul>
        </div>
        <div class="about-section">
          <h2>{{ t2s('聯絡我們') }}</h2>
          <p>{{ t2s('如有任何關於隱私的問題，請聯繫') }} <a href="mailto:contact@openteochew.com">contact@openteochew.com</a></p>
        </div>
        <div class="about-section">
          <p class="meta-text">{{ t2s('最後更新：2026-06-14') }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
