import { useState } from "react";

const layers = [
  {
    id: "user",
    label: "KULLANICI KATMANI",
    color: "#1e3a5f",
    items: [
      { icon: "🌐", title: "Web Tarayıcı", sub: "Chrome / Firefox / Safari\nHer cihaz, her yerden" },
      { icon: "🖥️", title: "Masaüstü App", sub: "Windows / macOS / Linux\nTauri v2 — 8MB installer" },
      { icon: "📱", title: "Mobil (Web)", sub: "Responsive UI\nPWA desteği" },
    ],
  },
  {
    id: "frontend",
    label: "FRONTEND — Tek Kod Tabanı",
    color: "#1a4731",
    items: [
      { icon: "⚛️", title: "React 19 + TypeScript", sub: "Vite • TanStack Router\nTanStack Query • Zustand" },
      { icon: "🎨", title: "Shadcn/UI + Tailwind", sub: "Karanlık/Açık tema\nResponsive tasarım" },
      { icon: "🔀", title: "Platform Algılama", sub: "window.__TAURI__ kontrolü\nRuntime'da servis seçimi" },
    ],
  },
  {
    id: "bridge",
    label: "PLATFORM KÖPRÜSÜ",
    color: "#4a1e6e",
    items: [
      { icon: "🌍", title: "Web Modu", sub: "REST API çağrıları\nHTTP → Fastify Server" },
      { icon: "🔗", title: "IPC Köprüsü", sub: "Tauri Komutları\nTypeScript ↔ Rust" },
      { icon: "📡", title: "WebSocket", sub: "Gerçek zamanlı sync\nOnline/Offline algılama" },
    ],
  },
  {
    id: "backend",
    label: "BACKEND KATMANI",
    color: "#5a2a00",
    items: [
      { icon: "⚡", title: "Fastify v5 API", sub: "Node.js cluster\nREST + WebSocket" },
      { icon: "🦀", title: "Rust (Tauri)", sub: "SQLite local DB\nSQLCipher şifreli" },
      { icon: "🔄", title: "Sync Engine", sub: "Conflict detection\nOffline queue → Online" },
    ],
  },
  {
    id: "data",
    label: "VERİ & ALTYAPI",
    color: "#1a3a1a",
    items: [
      { icon: "🐘", title: "PostgreSQL", sub: "Ana veritabanı\nPrimary + Replica" },
      { icon: "⚡", title: "Redis", sub: "Cache + Session\nBullMQ Queue" },
      { icon: "🔒", title: "SQLite", sub: "Desktop yerel DB\nŞifreli (SQLCipher)" },
    ],
  },
  {
    id: "hardware",
    label: "DONANIM & ENTEGRASYON",
    color: "#3a1a1a",
    items: [
      { icon: "🖨️", title: "Termal Yazıcı", sub: "Desktop: ESC/POS direkt\nWeb: Browser print API" },
      { icon: "📊", title: "Barkod Okuyucu", sub: "Desktop: HID + COM port\nWeb: Kamera + HID" },
      { icon: "🏦", title: "Dış Entegrasyon", sub: "e-Fatura GİB\nBanka API • Logo/Mikro" },
    ],
  },
];

const features = [
  { icon: "🛒", title: "Hızlı Satış (POS)", web: "✅", desktop: "✅ + Yazıcı/Çekmece" },
  { icon: "📦", title: "Stok Takibi", web: "✅", desktop: "✅ Eşit" },
  { icon: "👥", title: "Cari Hesap", web: "✅", desktop: "✅ Eşit" },
  { icon: "💰", title: "Finans / Kasa", web: "✅", desktop: "✅ Eşit" },
  { icon: "📵", title: "Offline Mod", web: "⚠️ Kısıtlı", desktop: "✅ Tam Destek" },
  { icon: "🖨️", title: "Termal Fiş", web: "⚠️ Browser print", desktop: "✅ ESC/POS direkt" },
  { icon: "📷", title: "Barkod", web: "⚠️ Kamera/HID", desktop: "✅ HID + COM port" },
  { icon: "👨‍💼", title: "Çok Kullanıcı", web: "✅ Doğal", desktop: "✅ Sync ile" },
];

const techStack = [
  { cat: "Frontend", items: ["React 19", "TypeScript", "Vite", "Tailwind CSS v4", "Shadcn/UI", "TanStack Query", "Zustand", "Recharts"] },
  { cat: "Desktop", items: ["Tauri v2", "Rust", "SQLite", "SQLCipher", "sqlx", "Tauri Updater"] },
  { cat: "Backend", items: ["Node.js", "Fastify v5", "Prisma ORM", "BullMQ", "WebSocket", "Redis"] },
  { cat: "Veritabanı", items: ["PostgreSQL 16", "Redis 7", "SQLite 3.45"] },
  { cat: "DevOps", items: ["Turborepo", "pnpm workspaces", "Docker", "Nginx", "GitHub Actions", "PM2"] },
  { cat: "Test", items: ["Vitest", "Playwright", "Testing Library", "MSW"] },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("mimari");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0a0f1a", color: "#e8eaf0", minHeight: "100vh", padding: "24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#4a9eff", textTransform: "uppercase", marginBottom: "8px" }}>
          POS / Stok / Cari / Finans
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px", color: "#fff" }}>
          Web + Masaüstü Hibrit Mimari
        </h1>
        <p style={{ color: "#8892aa", fontSize: "14px", margin: 0 }}>
          React + Tauri v2 — Tek kod tabanı, iki platform
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "28px" }}>
        {[
          { id: "mimari", label: "🏗️ Mimari" },
          { id: "karsilastirma", label: "⚖️ Karşılaştırma" },
          { id: "stack", label: "🛠️ Teknoloji" },
          { id: "sync", label: "🔄 Senkronizasyon" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              background: activeTab === tab.id ? "#4a9eff" : "#1a2235",
              color: activeTab === tab.id ? "#fff" : "#8892aa",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MİMARİ TAB */}
      {activeTab === "mimari" && (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {layers.map((layer, i) => (
            <div key={layer.id} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#556", textTransform: "uppercase", marginBottom: "6px", paddingLeft: "4px" }}>
                {layer.label}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "10px",
              }}>
                {layer.items.map((item, j) => (
                  <div key={j} style={{
                    background: layer.color,
                    border: `1px solid ${layer.color}88`,
                    borderRadius: "10px",
                    padding: "14px 16px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "22px", lineHeight: 1 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "13px", color: "#e8eaf0", marginBottom: "3px" }}>{item.title}</div>
                      <div style={{ fontSize: "11px", color: "#aab", lineHeight: "1.5", whiteSpace: "pre-line" }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              {i < layers.length - 1 && (
                <div style={{ textAlign: "center", margin: "6px 0", color: "#334", fontSize: "18px" }}>↕</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KARŞILAŞTIRMA TAB */}
      {activeTab === "karsilastirma" && (
        <div style={{ maxWidth: "750px", margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0",
            background: "#1a2235",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid #2a3550",
          }}>
            {/* Header */}
            <div style={{ padding: "14px 18px", background: "#111827", fontWeight: "700", fontSize: "12px", color: "#8892aa", letterSpacing: "1px" }}>ÖZELLİK</div>
            <div style={{ padding: "14px 18px", background: "#1a3a5f", fontWeight: "700", fontSize: "12px", color: "#4a9eff", textAlign: "center" }}>🌐 WEB</div>
            <div style={{ padding: "14px 18px", background: "#1a3a2a", fontWeight: "700", fontSize: "12px", color: "#4adf8f", textAlign: "center" }}>🖥️ MASAÜSTÜ</div>

            {features.map((f, i) => (
              <>
                <div key={`a${i}`} style={{ padding: "12px 18px", borderTop: "1px solid #2a3550", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <span>{f.icon}</span> {f.title}
                </div>
                <div key={`b${i}`} style={{ padding: "12px 18px", borderTop: "1px solid #2a3550", textAlign: "center", fontSize: "12px", color: f.web.startsWith("✅") ? "#4adf8f" : "#f5a623" }}>{f.web}</div>
                <div key={`c${i}`} style={{ padding: "12px 18px", borderTop: "1px solid #2a3550", textAlign: "center", fontSize: "12px", color: f.desktop.startsWith("✅") ? "#4adf8f" : "#f5a623" }}>{f.desktop}</div>
              </>
            ))}
          </div>

          <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[
              { title: "Web'in Avantajları", color: "#1a3a5f", accent: "#4a9eff", items: ["Kurulum gerektirmez", "Her cihazdan erişim", "Anlık güncelleme", "Mobil desteği", "Çok kullanıcı doğal"] },
              { title: "Masaüstünün Avantajları", color: "#1a2a1a", accent: "#4adf8f", items: ["Tam offline çalışma", "ESC/POS yazıcı direkt", "HID barkod okuyucu", "OKC POS entegrasyonu", "Şifreli lokal veritabanı"] },
            ].map((box, i) => (
              <div key={i} style={{ background: box.color, borderRadius: "10px", padding: "16px", border: `1px solid ${box.accent}33` }}>
                <div style={{ fontWeight: "700", color: box.accent, marginBottom: "10px", fontSize: "13px" }}>{box.title}</div>
                {box.items.map((item, j) => (
                  <div key={j} style={{ fontSize: "12px", color: "#ccd", padding: "3px 0", display: "flex", gap: "6px" }}>
                    <span style={{ color: box.accent }}>▸</span> {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TEKNOLOJİ TAB */}
      {activeTab === "stack" && (
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {techStack.map((cat, i) => (
            <div key={i} style={{ background: "#131b2e", border: "1px solid #2a3550", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontWeight: "700", color: "#4a9eff", marginBottom: "10px", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>{cat.cat}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cat.items.map((item, j) => (
                  <span key={j} style={{
                    background: "#1e2d4a",
                    border: "1px solid #2a3d60",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    color: "#c8d8f0",
                  }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SENKRONİZASYON TAB */}
      {activeTab === "sync" && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: "0", alignItems: "stretch" }}>
            {/* Sol: Desktop */}
            <div style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: "10px 0 0 10px", padding: "20px" }}>
              <div style={{ fontWeight: "700", color: "#4adf8f", marginBottom: "12px", fontSize: "13px" }}>🖥️ MASAÜSTÜ (SQLite)</div>
              {[
                "Satış yapılır (offline da)",
                "sync_queue tablosuna ekle",
                "operation: INSERT/UPDATE",
                "payload: JSON kaydı",
                "device_id + timestamp",
                "sync_status: 'pending'",
              ].map((s, i) => (
                <div key={i} style={{ background: "#0f1f0f", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px", fontSize: "12px", color: "#9fb", borderLeft: "2px solid #4adf8f" }}>
                  {i + 1}. {s}
                </div>
              ))}
            </div>

            {/* Orta: Sync */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px" }}>
              <div style={{ fontSize: "10px", color: "#556", textAlign: "center", lineHeight: 1.4 }}>WebSocket<br/>veya<br/>REST</div>
              <div style={{ fontSize: "24px" }}>⇄</div>
              <div style={{ background: "#2a1a4a", borderRadius: "8px", padding: "8px", fontSize: "10px", color: "#a89fd0", textAlign: "center", lineHeight: 1.4 }}>
                Conflict<br/>Detection
              </div>
            </div>

            {/* Sağ: Sunucu */}
            <div style={{ background: "#1a1a3a", border: "1px solid #2a2a5a", borderRadius: "0 10px 10px 0", padding: "20px" }}>
              <div style={{ fontWeight: "700", color: "#4a9eff", marginBottom: "12px", fontSize: "13px" }}>☁️ SUNUCU (PostgreSQL)</div>
              {[
                "Sync isteği alınır",
                "Conflict kontrolü yap",
                "updated_at karşılaştır",
                "Çakışma varsa: son kayıt kazanır",
                "Kritik veri: sunucu master",
                "sync_status: 'synced'",
              ].map((s, i) => (
                <div key={i} style={{ background: "#0f0f1f", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px", fontSize: "12px", color: "#99bbff", borderLeft: "2px solid #4a9eff" }}>
                  {i + 1}. {s}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {[
              { status: "🟢 Online", desc: "WebSocket açık\nAnlık senkronizasyon\nGerçek zamanlı stok", color: "#1a3a1a", accent: "#4adf8f" },
              { status: "🟡 Offline", desc: "SQLite'ta çalışmaya devam\nQueue biriktirir\nSatış durmuyor", color: "#3a3a1a", accent: "#f5c842" },
              { status: "🔵 Reconnect", desc: "Otomatik sync başlar\nQueue sırayla işlenir\nÇakışmalar çözülür", color: "#1a2a3a", accent: "#4a9eff" },
            ].map((s, i) => (
              <div key={i} style={{ background: s.color, border: `1px solid ${s.accent}44`, borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontWeight: "700", color: s.accent, marginBottom: "8px", fontSize: "13px" }}>{s.status}</div>
                <div style={{ fontSize: "12px", color: "#ccd", whiteSpace: "pre-line", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "32px", color: "#445", fontSize: "11px" }}>
        Tauri v2 + React 19 + Fastify v5 + PostgreSQL + SQLite (SQLCipher)
      </div>
    </div>
  );
}
