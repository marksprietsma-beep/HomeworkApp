# Local media storage

The app stores assignment question images locally so it remains portable and local-first. Cloud storage is intentionally not used.

## Storage path

By default, uploaded assignment question images are written under:

```text
./data/uploads/assignment-question-images/
```

Set `LOCAL_MEDIA_ROOT` to use a different local or mounted folder:

```bash
LOCAL_MEDIA_ROOT=/srv/homework-app/uploads
```

On a school server, point `LOCAL_MEDIA_ROOT` at a backed-up data volume that is outside the Git checkout. Keep that directory mounted across deploys so media survives application updates.

The default `data/uploads/` folder is ignored by Git and should not be committed.

## File validation

Server-side local media helpers validate files before writing them:

- Allowed image formats: PNG, JPEG/JPG, WEBP, and GIF.
- Detection uses image file signatures rather than trusting the browser-provided MIME type or original filename.
- Maximum file size: 5 MB.
- Empty files are rejected.
- Filenames are generated as `YYYY-MM-DD-random-uuid.ext`; the original uploaded filename is not trusted.
- Paths are constrained to `assignment-question-images/` and cannot traverse outside the configured media root.

## App paths

Stored files are served through the controlled media route:

```text
/media/assignment-question-images/<generated-filename>
```

Question metadata can continue storing the existing image fields:

- `imagePath`: the local `/media/...` path or an imported reference.
- `imageCaption`: optional visible caption text.
- `imageAltText`: optional alt text.

MAR-125 can call the reusable `storeAssignmentQuestionImage` server helper when it adds the attach-image UI, then save the returned `path`, `caption`, and `altText` values on the question record.
