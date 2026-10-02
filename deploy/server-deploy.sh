#!/usr/bin/env bash
# Install manually once. Run only through a forced-command deployment SSH key.
set -Eeuo pipefail
exec 9>/home/croz/apps/bas-beta/.iot-web-deploy.lock
flock -w 120 9
base=/home/croz/apps/bas-beta
container=bas-frontend-1
work=$(mktemp -d "$base/iot-web-release.XXXXXXXX")
# Receive archive; never execute repository scripts on the server.
head -c 5242881 > "$work/web.tar.gz"
test "$(wc -c < "$work/web.tar.gz")" -le 5242880
python3 - "$work" <<'PY'
import pathlib, sys, tarfile
root=pathlib.Path(sys.argv[1])
allowed={'index.html','styles.css','receiver-ui.css','receiver.mjs','mqtt_core.mjs','src/app.js','src/geometry.js','src/telemetry.mjs'}
with tarfile.open(root/'web.tar.gz','r:gz') as archive:
    members=archive.getmembers()
    if {m.name for m in members} != allowed or len(members)!=len(allowed):
        raise SystemExit('Unexpected archive contents')
    if any(not m.isfile() or m.size>2_000_000 for m in members):
        raise SystemExit('Invalid file type or size')
    for member in members:
        dest=root/'site'/member.name
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(archive.extractfile(member).read())
PY
docker inspect "$container" >/dev/null
docker cp "$container:/usr/share/nginx/html/iot-test" "$work/previous"
cp -R "$base/frontend/public/iot-test" "$work/previous-source"
rollback() {
  docker exec "$container" sh -c 'test ! -d /usr/share/nginx/html/iot-test-before-ci || { mv /usr/share/nginx/html/iot-test /usr/share/nginx/html/iot-test-failed-ci; mv /usr/share/nginx/html/iot-test-before-ci /usr/share/nginx/html/iot-test; }'
  echo "Deploy failed; backup kept at $work" >&2
  cp -R "$work/previous-source/." "$base/frontend/public/iot-test/"
}
trap rollback ERR
# Refuse an unfinished previous deployment rather than overwrite its backup.
docker exec "$container" test ! -e /usr/share/nginx/html/iot-test-before-ci
docker cp "$work/site" "$container:/usr/share/nginx/html/iot-test-next-ci"
docker exec "$container" sh -c 'mv /usr/share/nginx/html/iot-test /usr/share/nginx/html/iot-test-before-ci; mv /usr/share/nginx/html/iot-test-next-ci /usr/share/nginx/html/iot-test'
curl --fail --max-time 10 -H 'Host: server.aitrg.io.vn' http://127.0.0.1:8080/iot-test/ -o /dev/null
docker exec "$container" test -f /usr/share/nginx/html/iot-test/src/app.js
docker exec "$container" grep -q /iot-test/events /etc/nginx/conf.d/default.conf
# Keep source for future image rebuilds; nginx config and relay are untouched.
cp -R "$work/site/." "$base/frontend/public/iot-test/"
docker exec "$container" mv /usr/share/nginx/html/iot-test-before-ci "/usr/share/nginx/html/iot-test-backup-$(basename "$work")"
trap - ERR
echo "Deployed IoT web. Backup: $work"
