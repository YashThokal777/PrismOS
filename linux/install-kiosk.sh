#!/usr/bin/env bash
# PrismOS kiosk installer: makes a FRESH Debian 12 / Ubuntu 24.04 machine boot straight into PrismOS.
#
# UNTESTED: this was written on Windows and has never been run. Try it in a throwaway virtual machine first.
# It creates a user called "prism", turns on automatic login for it on tty1, and starts PrismOS there
# inside "cage" (a one-app Wayland compositor). Do not run it on a computer you use for anything else.
#
# Usage, from the PrismOS folder (the one that contains index.html and desktop/):
#   sudo bash linux/install-kiosk.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "Run this with sudo."; exit 1; fi
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$SRC/index.html" || ! -f "$SRC/desktop/main.js" ]]; then echo "Run this from a full PrismOS folder."; exit 1; fi

echo "==> Installing packages"
apt-get update
apt-get install -y --no-install-recommends cage nodejs npm git ca-certificates fonts-inter \
  libgtk-3-0 libnss3 libxss1 libasound2t64 libgbm1 xwayland pipewire wireplumber || \
apt-get install -y --no-install-recommends cage nodejs npm git ca-certificates fonts-inter \
  libgtk-3-0 libnss3 libxss1 libasound2 libgbm1 xwayland pipewire wireplumber

echo "==> Copying PrismOS to /opt/prismos"
rm -rf /opt/prismos
mkdir -p /opt/prismos
cp -r "$SRC"/*.html "$SRC"/*.js "$SRC"/*.css /opt/prismos/
mkdir -p /opt/prismos/desktop
cp "$SRC"/desktop/main.js "$SRC"/desktop/preload.js "$SRC"/desktop/package.json /opt/prismos/desktop/
(cd /opt/prismos/desktop && npm install --no-fund --no-audit)

echo "==> Creating the prism user"
id prism &>/dev/null || useradd -m -s /bin/bash -G video,audio,input prism
chown -R prism:prism /opt/prismos

echo "==> Automatic login on tty1"
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin prism --noclear %I $TERM
EOF

echo "==> Starting PrismOS at login"
cat > /home/prism/.bash_profile <<'EOF'
# Start PrismOS on the first console. Log out of it (Quit PrismOS) to get a shell on another tty.
if [[ -z "${WAYLAND_DISPLAY:-}" && "$(tty)" == "/dev/tty1" ]]; then
  exec cage -s -- /opt/prismos/desktop/node_modules/.bin/electron /opt/prismos/desktop \
    --ozone-platform=wayland --enable-features=UseOzonePlatform
fi
EOF
chown prism:prism /home/prism/.bash_profile

systemctl daemon-reload
echo
echo "Done. Reboot and the machine should start in PrismOS."
echo "To undo: rm /etc/systemd/system/getty@tty1.service.d/autologin.conf && systemctl daemon-reload"
