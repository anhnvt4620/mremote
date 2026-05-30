#!/bin/bash
set -e

# Host-shell: auto key setup + SSH
KEYFILE="/home/app/.ssh/id_rsa"
mkdir -p /home/app/.ssh

if [ ! -f "$KEYFILE" ]; then
  ssh-keygen -t rsa -b 2048 -N "" -f "$KEYFILE" -C "mremote-host" 2>/dev/null
  echo ""
  echo "======================================"
  echo " ONE-TIME SETUP: Copy this key to host"
  echo "======================================"
  echo ""
  cat /home/app/.ssh/id_rsa.pub
  echo ""
  echo "Run on HOST:"
  echo "  docker exec mremote cat /home/app/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys"
  echo "======================================"
  echo ""
fi

if [ -f "$KEYFILE" ]; then
  cat > /home/app/host-shell << WRAPPER
#!/bin/bash
exec ssh -i /home/app/.ssh/id_rsa -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${HOST_USER:-root}@172.17.0.1 -t "exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready (ssh ${HOST_USER:-root}@host)"
fi

exec node /app/src/cli/index.js "$@"
