<script setup>
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 720px;">
        <div class="about-hero">
          <h1>{{ t2s('關於 OpenTeochew') }}</h1>
          <p class="lead">{{ t2s('匯集所有潮州話字典、詞典與語料，統一數字化，以開源授權公開發布。查詞、閱讀，一個平台到底。') }}</p>
        </div>
        <div class="about-section">
          <h2>{{ t2s('核心理念') }}</h2>
          <ul class="about-list">
            <li><strong>{{ t2s('匯集而非創建') }}</strong><p>{{ t2s('收錄、整理、歸檔已有的潮州話字典、詞典與語料，不憑空造詞。') }}</p></li>
            <li><strong>{{ t2s('開放數據') }}</strong><p>{{ t2s('所有整理後的數據以 CC0 公共領域授權發布，允許自由使用、研究與二次開發。') }}</p></li>
            <li><strong>{{ t2s('描述主義') }}</strong><p>{{ t2s('收錄各家流行的寫法、讀音、用法，包含公認正確的用法，也包含新興的、小眾的用法。') }}</p></li>
            <li><strong>{{ t2s('來源透明') }}</strong><p>{{ t2s('每條結果標明原始字典、頁碼與版權狀態，可追溯至原始文獻。') }}</p></li>
          </ul>
        </div>
        <div class="about-section">
          <h2>{{ t2s('團隊') }}</h2>
          <ul class="about-list">
            <li>
              <span class="team-name">Tieⁿ Kiang</span>
              <span class="team-role">{{ t2s('語言學負責人、汕頭大學教師') }}</span>
              <p>{{ t2s('負責語料的審訂與終審，確保收錄內容的準確可靠。') }}</p>
            </li>
            <li>
              <span class="team-name">Lim Tsunhua</span>
              <span class="team-role">{{ t2s('開發者、某公司 AI 後端工程師') }}</span>
              <p>{{ t2s('平台架構設計、全棧開發和資料的初步校訂。') }}</p>
            </li>
            <li class="team-cta"><a href="mailto:contact@openteochew.com">{{ t2s('期待你的加入') }}</a></li>
          </ul>
        </div>
        <div class="about-section">
          <h2>{{ t2s('致謝') }}</h2>
          <ul class="thanks-list">
            <li>
              <a href="https://chhoe.taigi.info/" target="_blank" rel="noopener">Chhoe Taigi</a>
              — {{ t2s('網站創建的靈感來源，功能設計的重要參考') }}
            </li>
            <li>
              <a href="https://github.com/ButTaiwan/iansui" target="_blank" rel="noopener">Iansui</a>
              — {{ t2s('提供了精美的字體，並正確顯示了 PUJ') }}
            </li>
            <li>
              <a href="https://opencode.ai" target="_blank" rel="noopener">OpenCode</a>
              — {{ t2s('AI 輔助開發工具，本站大部分代碼由該工具產生') }}
            </li>
            <li>
              <a href="https://www.cloudflare.com" target="_blank" rel="noopener">Cloudflare</a>
              — {{ t2s('基礎設施託管，提供了極為慷慨的免費額度') }}
            </li>
          </ul>
        </div>
      </div>
    </section>
  </main>
</template>
