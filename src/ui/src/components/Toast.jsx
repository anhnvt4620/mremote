const ICONS = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export function Toast({ message, kind }) {
  return (
    <div class={`toast ${kind || 'info'}`}>
      <span class="material-symbols-outlined toast-icon">
        {ICONS[kind] || 'info'}
      </span>
      <span class="toast-msg">{message}</span>
    </div>
  );
}
