export function Sidebar({ tabs, active, onChange }) {
  return (
    <nav class="sidebar">
      <div class="brand">M</div>
      {tabs.map((t) => (
        <button
          key={t.id}
          class={`nav-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span class="material-symbols-outlined" style={{ fontSize: 20 }}>
            {t.icon}
          </span>
          <span class="tooltip">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
