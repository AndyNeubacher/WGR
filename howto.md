# What's there
pnpm dev:all

## Frontend (mobile-first, German only)

- `/capture` — two big buttons "Foto aufnehmen" (camera) / "Aus Galerie wählen" (gallery), preview with discard/upload, client-side downscale to ≤ 2 MB before POST.
- `/readings` — list with thumbnail, serial, volume, status (OCR läuft / Bereit / Bestätigt).
- `/readings/[id]` — primary photo, OCR-pending banner, editable Seriennummer + Verbrauch + Notiz fields, Speichern / Speichern und bestätigen, plus "Zusatzfotos" gallery (add/delete, never OCR'd).
- `QueueIndicator` in the header: green dot + "Online", amber dot + "Offline", or "{n} Upload(s) in der Warteschlange".

## Backend

- `POST /api/readings` — multipart upload, three-step transaction (Reading → Photo → link primary), enqueues OCR job, returns DTO.
- `PATCH /api/readings/[id]` — verify/correct, optional `verified: true` to set `verifiedAt`.
- `POST /api/readings/[id]/photos` — auxiliary upload (no OCR enqueue).
- `DELETE /api/readings/[id]/photos/[photoId]` — refuses to delete the primary.
- `GET /api/photos/[id]` — auth-gated photo serving from disk.

## Infrastructure

- `lib/storage.ts` — disk writes under `STORAGE_ROOT/yyyy/mm/<uuid>.jpg`, with path-traversal guard on read.
- `lib/queue.ts` + `worker/index.ts` — DB-backed job queue, optimistic claim with `updateMany`, exponential backoff up to 5 attempts, SIGINT/SIGTERM-clean.
- `lib/offline-queue.ts` — IndexedDB persistence (`idb`), replay on reconnect via the `online` window event.
- `ocr-service/app.py` — FastAPI on `127.0.0.1:8001`. Uses a Roboflow watermeter detector to crop barcode/serial/consumption regions, decodes 2D barcodes via pyzbar/pylibdmtx for the serial, and runs a local Roboflow digit-detection model (YOLO26) for both the consumption gauge and a serial-number fallback.
- `lib/auth.ts` — stub `currentUser()` returning a fixed dev user; every route already calls it, so task 3 swaps the body and nothing else changes.

## How to run it locally

```powershell
# 1. Node deps
pnpm install

# 2. Python OCR sidecar (one-time, in its own venv)
cd ocr-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..

# 3. Database (MariaDB or MySQL running locally)
copy .env.example .env
# edit DATABASE_URL in .env to point at your local MariaDB
pnpm db:migrate     # creates tables

# 4. Run all three processes
pnpm dev:all        # web (3000) + worker + OCR sidecar (8001)
```

Open `http://localhost:3000` on your phone (same network, or via tunnel) — the camera button hits the native camera through `capture="environment"`.

## Known TODOs / deferred for task 2/3

- **Auth**: stubbed. Wire Auth.js v5 in `lib/auth.ts` for task 3; no call sites change.
- **Manager screens**: `/(manager)` route group not created yet — add when task 2 starts.
- **Customer / Site / Gauge schema**: not in `prisma/schema.prisma` yet. Add as new models when task 3 opens; `Reading.gaugeId` and `Reading.technicianId` are already nullable foreign-key columns ready to point at them.
- **Auxiliary photo offline queue**: only primary uploads survive offline; auxiliaries require online (the local→server id mapping the CLAUDE.md describes is deferred).
- **PWA service worker**: manifest is in place but no SW yet — `@serwist/next` can be added without restructuring.
- **PNG icons**: `/icon-192.png` and `/icon-512.png` aren't in `public/` — add them before installing as a PWA.
