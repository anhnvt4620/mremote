#!/bin/bash
set -e

# Auto host-shell setup
if [ -n "${HOST_USER}" ]; then
  cat > /home/app/host-shell << WRAPPER
#!/bin/bash
exec ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${HOST_USER}@172.17.0.1 -t "exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready (ssh ${HOST_USER}@host)"
fi

exec node /app/src/cli/index.js "$@"
