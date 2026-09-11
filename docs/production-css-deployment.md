# Production CSS deployment and recovery

Clarion's CSS is emitted as a content-hashed file under `.next/static/css`. The
HTML and the complete `.next` directory must therefore always come from the same
build. Replacing `.next/static` independently, or deleting the live `.next`
directory before a build succeeds, can leave browsers requesting a hash that no
longer exists and makes the application appear as unstyled HTML.

## Build and deploy

Generate Prisma's client before building. `npm run build` now verifies that the
app build manifest references non-empty CSS and that the output contains both
Tailwind and the student appearance rules.

```bash
npm ci
npm run prisma:generate
npm test
npm run lint
npm run build
```

Build in a new release directory, then switch the release symlink and restart
the application only after every command succeeds. Never copy only
`.next/static`, and never remove the active release's `.next` directory in
place. Keep the previous release until the checks below pass so the symlink and
service can be rolled back together.

## Production verification

Obtain the current CSS URL from freshly fetched HTML, then check the same URL at
the public origin. A successful response must be `200`, have a `text/css`
content type, and contain a non-empty body.

```bash
origin=https://clarion.example.com
html=$(mktemp)
curl --fail --silent --show-error -H 'Cache-Control: no-cache' "$origin/" -o "$html"
css_path=$(sed -n 's/.*href="\([^\"]*\/_next\/static\/css\/[^\"]*\.css\)".*/\1/p' "$html" | head -n 1)
test -n "$css_path"
curl --fail --silent --show-error --dump-header /tmp/clarion-css.headers \
  -H 'Cache-Control: no-cache' "$origin$css_path" -o /tmp/clarion.css
grep -i '^content-type: *text/css' /tmp/clarion-css.headers
test -s /tmp/clarion.css
```

Repeat from a private browser session and confirm the Network panel has no
`/_next/static/` 404 or 403 responses. If the CSS URL fails, restore the
previous complete release or redeploy a fresh complete build; purging only an
HTML cache is insufficient if the referenced chunk is absent.

At the reverse proxy, do not cache application HTML across deployments. Next's
hashed `/_next/static/` assets may be cached as immutable, provided every asset
is served from the same release as the running Next process.
