#!/bin/bash
set -e

# Create host-shell via nsenter (requires --pid=host in docker-compose)
if [ -x /usr/bin/nsenter ]; then
  cat > /home/app/host-shell << 'WRAPPER'
#!/bin/bash
exec nsenter -t 1 -m -u -i -n -p -- su -l "${HOST_USER:-root}" -c "exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready (user: ${HOST_USER:-root})"
fi

exec node /app/src/cli/index.js "$@"
