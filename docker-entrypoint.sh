#!/bin/bash
# MRemote entrypoint - auto host shell setup
set -e

# Create host-shell wrapper if /host is mounted
if [ -d /host/bin ] && [ -f /host/bin/bash ]; then
  cat > /home/app/host-shell << 'WRAPPER'
#!/bin/bash
HOST_USER="${HOST_USER:-root}"
HOST_DIR="/host/home/${HOST_USER}"
[ -d "$HOST_DIR" ] || HOST_DIR="/host/root"
exec chroot /host /bin/su -l "$HOST_USER" -c "cd /home/${HOST_USER} 2>/dev/null || cd /root; exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready (user: ${HOST_USER:-root})"
fi

exec node /app/src/cli/index.js "$@"
