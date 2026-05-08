# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Greenfield web application for a water-utility company. Service technicians visit customer sites and photograph mechanical (non-networked) water meters. The app extracts the **serial number** and **consumed volume** from each photo via OCR, lets the technician verify and correct the result, and stores it. Managers later review and annotate the readings.

UI is **German only**.

Three feature scopes (full text in the Requirements appendix at the bottom):

- **Task 1 — current scope.** Technician mobile flow: capture/select photo, review, upload, OCR, verify, persist.
- **Task 2 — deferred.** Manager desktop flow: browse readings, annotate at multiple levels.
- **Task 3 — deferred.** Login + customer-site / gauge navigation tree.

Only task 1 is being built now. The architecture must accept tasks 2 and 3 without a rewrite.

## Stack

- **Runtime / framework**: Next.js 15 App Router on Node.js 20+, TypeScript strict
- **UI**: Tailwind CSS v4 + shadcn/ui, mobile-first; all user-facing copy lives in `messages/de.json`, looked up via a tiny flat-key `t()` helper in `lib/i18n.ts`. Single locale, no URL prefix — swap to `next-intl` if multi-locale is ever needed.
- **Forms**: react-hook-form + zod (schemas shared between client and server)
- **Server state**: TanStack Query
- **Database**: MariaDB / MySQL with **InnoDB** engine, accessed via Prisma (`provider = "mysql"`)
- **OCR**: Python FastAPI sidecar on loopback HTTP using **Roboflow inference** (local YOLO digit-detection model + watermeter region detector) + pyzbar/pylibdmtx for 2D barcodes. The Node app never imports Python.
- **Photo storage**: local filesystem on the server, outside the public web root, served via an auth-gated Next.js route handler. No S3, no presigned URLs — world4you provides neither.
- **Job queue**: DB-backed (`jobs` table in MariaDB), single worker, optimistic claim with stuck-row reclaim (no Redis, no `FOR UPDATE SKIP LOCKED`).
- **PWA / offline**: IndexedDB-backed upload queue that retries on reconnect. Manifest is in place; full service worker (`@serwist/next`) is **not yet wired**.
- **Testing**: Vitest (unit) + Playwright (e2e, mobile viewport) — **not yet set up**, no scripts wired in `package.json`.
- **Tooling**: pnpm, ESLint, Prettier

## Hosting — world4you.com (EU, Austria)

> **Target tier: world4you "my V-Server"** (smallest plan is sufficient to start). Debian/Ubuntu LTS, MariaDB from the distro repo, systemd manages three units: `wgr-web`, `wgr-worker`, `wgr-ocr`. Shared "Webhosting" is **not** viable for this stack.

Implications already baked into the choices above:

- **No S3** → photos go on local disk under `STORAGE_ROOT`.
- **No Redis** → queue lives in MariaDB.
- **No Docker registry assumed** → deploys ship built artifacts via SSH/rsync, not container images.
- **EU data residency** is mandatory. No third-party OCR APIs, no foreign CDNs for user data.

## Domain model

Task 1 needs `Reading` + `Photo`. The schema is shaped so that task 2 and 3 entities slot in without migration churn.

A reading has **one or more** photos. Exactly **one** of them — the one `Reading.primaryPhotoId` points at — is the OCR target. The rest are auxiliary attachments the technician adds for context (other angles, surroundings, damage, the meter cabinet) and are never sent to OCR.

```
Reading {
  id              uuid pk
  primaryPhotoId  uuid? fk → Photo.id   // the photo OCR runs on
  serialNumber    string?               // OCR output, technician-correctable
  consumedVolume  decimal(12,3)?        // OCR output, technician-correctable
  ocrStatus       enum('pending','done','failed')
  technicianNote  string?
  createdAt       datetime
  verifiedAt      datetime?             // set when technician confirms

  // Reserved for task 3 — nullable until then
  gaugeId         uuid? fk → Gauge.id
  technicianId    uuid? fk → User.id

  photos          Photo[]
}

Photo {
  id          uuid pk
  readingId   uuid fk → Reading.id (on delete cascade)
  path        string                    // relative to STORAGE_ROOT
  caption     string?                   // optional per-photo note
  createdAt   datetime
}
```

The "primary" relationship is intentionally one-directional: `Reading.primaryPhotoId` defines which photo is OCR'd; all other `Photo`s with the same `readingId` are auxiliary by definition. This avoids a `kind` column and the partial-unique-constraint problem MariaDB doesn't solve cleanly. Application-level invariant: when `primaryPhotoId` is set, that photo's `readingId` must equal the reading's id (enforced in the service layer, not via a check constraint).

Stubbed in `prisma/schema.prisma` but not exposed in the UI yet: `Customer`, `Site`, `Gauge`, `User`. Multi-level notes from task 2 will be a polymorphic `Note { targetType, targetId, body, authorId }`.

All tables use `ENGINE=InnoDB` (default in MariaDB; pinned explicitly via Prisma).

## Project layout

```
/app
  /(technician)            # mobile-first routes — task 1
    /capture               # take primary photo, review, upload
    /readings              # list of recent uploads
    /readings/[id]         # verify-and-correct page; add/remove auxiliary photos
  /(manager)               # task 2, scaffold only
  /api
    /readings              # POST create-with-primary-photo, GET list, PATCH verify
    /readings/[id]/photos  # POST add auxiliary photo, DELETE remove
    /photos/[id]           # auth-gated photo serving (primary + auxiliary)
/lib
  /db                      # Prisma client + query helpers
  /ocr                     # HTTP client for the Python sidecar
  /queue                   # DB-backed enqueue/claim/complete
  /storage                 # disk writes under STORAGE_ROOT
  /auth                    # stub today; Auth.js in task 3
/components/ui             # shadcn primitives
/messages/de.json          # all German strings (custom t() helper, see lib/i18n.ts)
/prisma/schema.prisma
/ocr-service               # Python FastAPI sidecar (Roboflow inference + barcode decoders)
/worker                    # queue worker entrypoint
/tests
```

## Commands

```
pnpm install

pnpm dev               # Next dev server (port 3000)
pnpm worker            # queue worker, tsx --watch
pnpm ocr               # uvicorn OCR sidecar with --reload (port 8001)
pnpm dev:all           # all three concurrently

pnpm build
pnpm start             # production Next server
pnpm worker:prod       # queue worker, no watch
pnpm ocr:prod          # uvicorn OCR sidecar without --reload

pnpm db:migrate        # prisma migrate dev
pnpm db:generate       # prisma generate
pnpm db:studio
pnpm db:push           # push schema without creating a migration

pnpm lint
```

`pnpm test` / `pnpm test:e2e` are **not** wired yet — Vitest and Playwright still need installing.

Local setup recipe (MariaDB, Python venv for the OCR sidecar, `.env` template): see `howto.md`.

## Architecture notes

- **Photo capture**: HTML `<input type="file" accept="image/*" capture="environment">` for the camera button; same input without `capture` for the gallery button. Client-side downscale via `browser-image-compression` to ≤ 2 MB before upload to keep cellular payloads small.
- **Upload flow (primary photo, three-step transaction)**: browser POSTs multipart to `/api/readings`. The API saves the file to `STORAGE_ROOT/yyyy/mm/<uuid>.<ext>`, then in a single Prisma transaction: (1) inserts the `Reading` row with `ocrStatus='pending'`, (2) inserts a `Photo` row with `readingId = reading.id`, (3) updates the reading to set `primaryPhotoId = photo.id`. The three steps are required because `Reading.primaryPhotoId` and `Photo.readingId` are mutually circular FKs — neither row can be inserted with both relations populated. **Anyone adding a new "create reading" entry point must replicate this pattern.** If the transaction fails after the file is on disk, the route deletes the orphaned file before propagating the error.
- **Auxiliary photos**: from the verify page, the technician can attach more photos via `POST /api/readings/[id]/photos`. These are stored under the same path scheme but are **never** OCR'd — only the primary photo is enqueued. Auxiliary uploads currently require online connectivity; offline replay for them is deferred (see "Implemented vs deferred" below).
- **Offline queue**: when the primary-photo POST fails, the file + metadata are persisted to IndexedDB by `lib/offline-queue.ts` and replayed on `online` events plus on every `QueueIndicator` mount. The queue indicator in the header shows online status + pending count.
- **OCR sidecar**: Python FastAPI on `127.0.0.1:8001`, one endpoint `POST /ocr` that takes a photo path and returns `{ serialNumber, consumedVolume }`. The sidecar uses a Roboflow watermeter-detection model to crop barcode/serial/consumption regions, decodes 2D barcodes (pyzbar/pylibdmtx) for the serial, and runs a Roboflow digit-detection model on the consumption (and serial fallback) crops. The sidecar runs under the same supervisor as the Node app.
- **DB queue (optimistic claim, single worker)**: `jobs (id, type, payload_json, status, attempts, run_at, locked_by, locked_until)`. Worker polls every ~2 s. Claim algorithm: `findFirst` for any pending row OR a `running` row whose `lockedUntil` has expired (stuck-job recovery), then `updateMany` filtered on the same condition to atomically transition it to `running`. If `updateMany` returns count=0 someone else won the race; we retry next tick. **No `SELECT … FOR UPDATE SKIP LOCKED`** — single-worker is the design assumption. Don't "fix" this without raising it.
- **Auth stub → real**: every server action and route handler calls `await currentUser()` from `lib/auth.ts`. Today it returns a fixed dev user; in task 3 it returns the Auth.js v5 session. Call sites do not change.
- **i18n**: tiny custom `t()` helper in `lib/i18n.ts` flattens `messages/de.json` to dot-keyed strings at module load. Single `de` locale. No string is hard-coded in components.

## Scope discipline

Build task 1 only. Do **not** build manager screens, customer-site / gauge navigation, or login until tasks 2 and 3 are explicitly opened — but **do** write the schema, route groups, and auth stub so those tasks slot in without refactoring.

## Implemented vs deferred

| Area | Status |
| --- | --- |
| Capture page (camera + gallery + review + upload) | wired |
| Primary-photo upload + storage on disk | wired |
| OCR pipeline (Paddle sidecar + DB queue + worker) | wired |
| Verify-and-correct form (Seriennummer / Verbrauch / Notiz / bestätigen) | wired |
| Auxiliary photos (online add/delete, list) | wired |
| Offline queue for primary uploads | wired (in-page IndexedDB + `online` event) |
| Auth stub (`currentUser()`) | wired |
| Real Auth.js v5 / login | **deferred — task 3** |
| Manager screens (`/(manager)`) | **deferred — task 2** |
| `Customer` / `Site` / `Gauge` / `User` Prisma models | **deferred — task 3** (reading already has nullable `gaugeId` / `technicianId` FKs) |
| Auxiliary-photo offline queue (parent-id resolution) | **deferred** — auxiliaries currently online-only |
| PWA service worker | **deferred** — manifest present, no SW yet |
| `/icon-192.png` and `/icon-512.png` | **missing** — referenced by manifest, not in `public/` |
| Vitest / Playwright | **deferred** — not installed, no scripts |

---

## Requirements appendix (original brief, verbatim)

### Role
You are a senior software engineer with more than 10 years of experience in software development. You are an expert in developing web applications running on mobile devices. As an expert in this field, you are aware of the existence of various technologies and tools that can be used to develop web applications running on mobile devices. You are also aware of the latest trends and best practices in this field.

### Background
I am working on a project that requires building a web application for a company that sells water measurement gauges. The used gauges are mechanical and they are not connected to the internet. The technician will visit the customer site and record the water measurement data by taking photos of the gauges.

### Task 1
The service technician uses the web app on the mobile phone which is connected to the internet. The app should have the following features:

1. Take a photo of the gauge
2. Let the technician select the photo from the photo gallery
3. The technician can review the image before it gets uploaded
4. Upload the photo to the server
5. The photo is stored on the server
6. The technician can view the photo on the server
7. The serial number on the gauge is automatically extracted from the photo using OCR
8. The consumed volume is also shown on the photo and should be extracted using OCR
9. The technician should be able to verify the extracted data and correct it if necessary
10. The image, serial number and consumed volume are stored on the server

### Task 2
The manager uses the web app on the desktop computer which is connected to the internet. The app should have the following features:

1. The manager can view the photo on the server
2. The manager can view the serial number on the server
3. The manager can view the consumed volume on the server
4. The manager can add notes to the photo
5. The manager can add notes to the serial number
6. The manager can add notes to the gauge
7. The manager can add notes to the customer site

### Task 3
1. The manager can create different user accounts
2. all password user credentials are stored encrypted in the database
3. The manager can assign technician users to sites
4. The manager can assign specific gauges to technicians
5. the technician will only see the gauges that are assigned to him

### Task 4
1. Create a Login page 
2. After user logs in, the technician can see all the gauges that are assigned to him
3. For each gauge, a button to take a photo
4. A button to submit the data
