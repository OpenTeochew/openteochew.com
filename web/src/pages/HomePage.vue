<template>
  <main>
    <section class="section home-hero">
      <div class="container">
        <p class="hero-brand"><span class="brand-accent">Open</span>Teochew</p>
        <p class="hero-sub">開放潮州話 Tiê-tsiu-uē</p>
        <p class="hero-desc">匯集所有潮州話字典、詞典與語料，統一數字化，以開源授權公開發布。查詞、閱讀，一個平台到底。</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="sites-grid">
          <router-link to="/tshue" class="site-card">
            <div class="site-card-name">Tshue <small>查</small></div>
            <p>潮州話詞典查詢。支持白話字（PUJ）、潮州拼音（DP）、漢字、英文多維度檢索。一次搜索聚合所有字典來源。</p>
            <div class="site-card-links">
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>搜索首頁</span>
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4M7 11h10M7 15h6"/></svg>搜索結果</span>
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>詞條詳情</span>
            </div>
          </router-link>
          <router-link to="/thak" class="site-card">
            <div class="site-card-name">Thak <small>讀</small></div>
            <p>瀏覽原始字典頁面，閱讀潮州話語料與文本。所有資料標明出處，支持原書掃描與 OCR 對照。</p>
            <div class="site-card-links">
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>閱讀首頁</span>
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>語料閱讀</span>
              <span class="site-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>字典原書</span>
            </div>
          </router-link>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container principles">
        <h2>核心理念</h2>
        <div class="principle-list">
          <div class="principle-item"><strong>匯集而非創建</strong><p>收錄、整理、歸檔已有的潮州話字典、詞典與語料，不憑空造詞。</p></div>
          <div class="principle-item"><strong>開放數據</strong><p>所有整理後的數據以 CC0 公共領域授權發布，允許自由使用、研究與二次開發。</p></div>
          <div class="principle-item"><strong>描述主義</strong><p>收錄各家流行的寫法、讀音、用法，包含公認正確的用法，也包含新興的、小眾的用法。</p></div>
          <div class="principle-item"><strong>來源透明</strong><p>每條結果標明原始字典、頁碼與版權狀態，可追溯至原始文獻。</p></div>
        </div>
      </div>
    </section>
  </main>
</template>
