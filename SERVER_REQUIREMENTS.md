# WGR Production Server Requirements

Based on the project's architecture (`CLAUDE.md`, Node dependencies, and Python sidecar), here is a complete breakdown of what you need to install on your Debian/Ubuntu LTS server (e.g., world4you V-Server).

## 1. Core System Software

You will need to install the following core runtimes from the official package managers:

- **Node.js**: Version 20 or higher.
- **Python**: Version 3.10–3.12. Ensure you install `python3-venv` and `python3-pip`. The OCR sidecar uses Roboflow `inference` (which pulls in torch); torch wheels are available for these Python versions on Linux x86_64.
- **MariaDB** (or MySQL): The primary database.
- **pnpm**: The Node.js package manager used by the project (`npm install -g pnpm`).

## 2. Shared C/C++ Libraries (Crucial for OCR)

The Python OCR sidecar relies on native C libraries for image processing (`cv2`) and barcode decoding (`pyzbar`). If these are missing on a headless Linux server, the OCR service will crash on startup or when attempting to read an image.

```bash
sudo apt-get update
sudo apt-get install -y libgl1 libglib2.0-0  # Required by OpenCV (cv2)
sudo apt-get install -y libzbar0             # Required by pyzbar for barcode detection
```

## 3. Reverse Proxy & SSL

Since the Next.js app runs on port 3000 by default, you need a reverse proxy to expose it on ports 80/443 and handle SSL certificates.

- **Nginx** or **Caddy** (Caddy is recommended for automatic SSL configuration).
- **Certbot / Let's Encrypt**: If using Nginx, you will need this to secure the site with HTTPS.

## 4. The Three Application Services

The WGR app is not a single monolith; it consists of three distinct processes that must be kept alive. Since you are deploying on a V-Server without Docker (as per `CLAUDE.md`), you should use Linux **systemd** to manage these as background services:

1. **The Web Server (`wgr-web.service`)**:
   Runs the compiled Next.js application.
   *Command*: `pnpm start` (Runs on port 3000)

2. **The Job Queue Worker (`wgr-worker.service`)**:
   Polls the MariaDB database to process background tasks (like OCR extraction).
   *Command*: `pnpm worker:prod`

3. **The Python OCR Sidecar (`wgr-ocr.service`)**:
   The local API that performs the actual image analysis.
   *Command*: `pnpm ocr:prod` (Runs on `127.0.0.1:8001`)

## 5. Storage Directory

Since the app does not use S3, you need a directory on the local disk to store uploaded photos.
- Create a directory outside of your web root (e.g., `/var/lib/wgr/storage`).
- Ensure the user running the Node.js application (e.g., `www-data` or a dedicated `wgr` user) has **read and write permissions** to this directory.
- Define this path in your `.env` file as `STORAGE_ROOT=/var/lib/wgr/storage`.

---

## High-Level Setup Checklist

1. [ ] Install Node.js, Python, MariaDB, and Nginx.
2. [ ] Install the native C libraries (`libgl1`, `libzbar0`, etc.).
3. [ ] Create a dedicated unprivileged Linux user to run the app.
4. [ ] Clone/rsync the repository to `/opt/wgr`.
5. [ ] Create a production `.env` file with `DATABASE_URL`, `STORAGE_ROOT`, and secure secrets.
6. [ ] Run `pnpm install` in the Node directory.
7. [ ] Run `pnpm build` to compile the Next.js frontend.
8. [ ] Set up the Python virtual environment (`python3 -m venv .venv`) and `pip install -r requirements.txt`.
9. [ ] Run `pnpm db:migrate` to set up the database schema.
10. [ ] Create the 3 `systemd` unit files and `systemctl enable --now` them.
11. [ ] Configure Nginx to `proxy_pass http://localhost:3000`.
