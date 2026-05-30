#!/bin/bash
set -e

KEYFILE="/home/app/.ssh/id_rsa"
mkdir -p /home/app/.ssh
chmod 700 /home/app/.ssh

if [ ! -f "$KEYFILE" ]; then
  ssh-keygen -t rsa -b 2048 -N "" -f "$KEYFILE" -C "mremote-host" 2>/dev/null
  chmod 600 "$KEYFILE" /home/app/.ssh/id_rsa.pub
fi

# Auto-add key to host authorized_keys
HOST_SSH="/home/${HOST_USER}/.ssh"
if [ -n "${HOST_USER}" ] && [ -d "/home/${HOST_USER}" ]; then
  mkdir -p "$HOST_SSH" 2>/dev/null || true
  chmod 700 "$HOST_SSH" 2>/dev/null || true
  if ! grep -q "mremote-host" "$HOST_SSH/authorized_keys" 2>/dev/null; then
    cat /home/app/.ssh/id_rsa.pub >> "$HOST_SSH/authorized_keys" 2>/dev/null && \
      echo "[MRemote] SSH key auto-added to ${HOST_USER}@host" || \
      echo "[MRemote] WARNING: run: docker exec mremote cat /home/app/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys"
    chmod 600 "$HOST_SSH/authorized_keys" 2>/dev/null || true
  fi
fi

# Create host-shell wrapper
if [ -f "$KEYFILE" ]; then
  cat > /home/app/host-shell << WRAPPER
#!/bin/bash
exec ssh -i /home/app/.ssh/id_rsa -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PasswordAuthentication=no ${HOST_USER:-root}@172.17.0.1 -t "exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready (ssh ${HOST_USER:-root}@host)"
fi

exec node /app/src/cli/index.js "$@"

