# Production static-asset deployment and recovery

Clarion runs from `/opt/clarion` under `clarion.service`. Next emits
content-hashed CSS and JavaScript under `.next/static`; the running process,
server output, and the complete `.next/static` directory must come from the same
build. Running `next build` over `.next` while the old `next start` process is
still serving can remove chunks that the process's HTML still references. The
result can be either unstyled HTML or a client-side application exception.

## Build and deploy at `/opt/clarion`

Use a short maintenance window. Stop the service before replacing the live
`.next` build, and do not start it again unless the complete build succeeds.
The repository deliberately has no lockfile, so use `npm install`, not `npm ci`.

```bash
cd /opt/clarion
sudo systemctl stop clarion.service
npm install --include=dev --package-lock=false --no-audit --no-fund
npm run prisma:generate
npm test
npm run lint
rm -rf .next
npm run build
sudo systemctl start clarion.service
sudo systemctl --no-pager --full status clarion.service
```

The `postbuild` check reads Next's app and pages build manifests, requires every
referenced CSS and JavaScript static asset to exist and be non-empty, and checks
that the compiled CSS still contains Tailwind and student appearance rules. If
installation, generation, tests, lint, or build fails, leave the service stopped
while the source/build failure is corrected; do not restart it with a partial
`.next` directory.

## Runtime verification

Fetch fresh HTML from the public login page, then extract every CSS and
JavaScript `/_next/static/` URL and request it from the public origin. This
detects stale public HTML referencing a removed chunk as well as missing styles
without putting production session credentials in shell history.

```bash
origin=https://clarion.haikouhaluolideceshi.xyz
workdir=$(mktemp -d)

html="$workdir/login.html"
assets="$workdir/login.assets"
curl --fail --silent --show-error -H 'Cache-Control: no-cache' \
  "$origin/login" -o "$html"

grep -oE '/_next/static/[^"'"'"' ]+\.(css|js)' "$html" | sort -u > "$assets"
test -s "$assets"

while IFS= read -r asset; do
  headers="$workdir/headers"
  body="$workdir/body"
  curl --fail --silent --show-error --dump-header "$headers" \
    -H 'Cache-Control: no-cache' "$origin$asset" -o "$body"
  test -s "$body"
  case "$asset" in
    *.css) grep -iq '^content-type: *text/css' "$headers" ;;
    *.js)  grep -Eiq '^content-type: *(application|text)/(javascript|x-javascript)' "$headers" ;;
  esac
done < "$assets"
```

After those commands pass:

1. Sign in normally in a new private/incognito session, then open `/` and
   `/classes/3`. Do not copy the authenticated session cookie into shell commands.
2. Confirm the Network panel has no `/_next/static/` 404 or 403 response.
3. Confirm the Console has no hydration, chunk-load, or client exception. Record
   the complete stack trace if `/classes/3` still fails; that would indicate a
   route-specific defect rather than the remediated asset mismatch.
4. Hard-refresh both routes and repeat the Console and Network checks.
5. Inspect service logs around the requests:

   ```bash
   sudo journalctl -u clarion.service --since '15 minutes ago' \
     --no-pager --output=short-iso
   ```

Do not cache application HTML across deployments at the reverse proxy. Hashed
`/_next/static/` assets may be cached as immutable because the stopped-service
deployment procedure ensures that new HTML and new chunks become available
together.
