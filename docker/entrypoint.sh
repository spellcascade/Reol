#!/bin/sh

set -eu

log_dir="/var/log/yt-dlp"
log_file="$log_dir/update.log"

mkdir -p "$log_dir"

update_once() {
  yt-dlp -U 2>&1 | tee -a "$log_file" || true
}

update_once

while true; do
  # 6 hours
  sleep 21600
  update_once
done &

exec "$@"
