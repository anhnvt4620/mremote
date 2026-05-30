#!/bin/bash
set -e

# Create host-shell via privileged helper container (works with docker socket)
if [ -S /var/run/docker.sock ]; then
  cat > /home/app/host-shell << 'WRAPPER'
#!/bin/bash
docker run --rm -i --pid=host --privileged --network=host \
  -e HOST_USER="${HOST_USER:-root}" \
  alpine:latest \
  nsenter -t 1 -m -u -n -p -- su -l "${HOST_USER:-root}" -c "cd ~; exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready via docker (user: ${HOST_USER:-root})"
fi

exec node /app/src/cli/index.js "$@"
