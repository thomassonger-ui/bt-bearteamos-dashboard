import Sidebar from '@/components/Sidebar'
import KnowledgeQuery from '@/components/KnowledgeQuery'

export default function KnowledgePage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--bt-text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Knowledge
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>System Rules & Reference</div>
            <div style={{ fontSize: 12, color: 'var(--bt-text-dim)', marginTop: 4 }}>
              Static reference for Phase 1. AI-powered query via Scout in Phase 2.
            </div>
          </div>
          <KnowledgeQuery />
        </div>
      </main>
    </div>
  )
}
