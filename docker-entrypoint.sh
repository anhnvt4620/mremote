#!/bin/bash
set -e

# Create host-shell via privileged busybox container + chroot
if [ -S /var/run/docker.sock ]; then
  cat > /home/app/host-shell << 'WRAPPER'
#!/bin/bash
docker run --rm -i --privileged --network=host \
  -v /:/rootfs \
  -e HOST_USER \
  busybox:latest \
  chroot /rootfs /bin/su -l "${HOST_USER:-root}" -c "exec /bin/bash --login"
WRAPPER
  chmod +x /home/app/host-shell
  echo "[MRemote] host-shell ready via docker+chroot (user: ${HOST_USER:-root})"
fi

exec node /app/src/cli/index.js "$@"
