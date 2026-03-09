# CI/CD and cPanel Deployment: app.stagepass.co.ke

Step-by-step procedure to set up CI/CD in cPanel and deploy the Stagepass project to **app.stagepass.co.ke**.

---

## Prerequisites

- cPanel access on the host where **stagepass.co.ke** is managed.
- **app.stagepass.co.ke** DNS: an A (or CNAME) record pointing to your server’s IP (or create the subdomain in cPanel and use its instructions).
- Your Stagepass code in a Git repository (GitHub, GitLab, or Bitbucket).
- SSH access to the server (optional but recommended for deploy scripts and troubleshooting).

---

## Part 1: Create the subdomain in cPanel

1. Log in to **cPanel**.
2. Open **Domains** → **Subdomains** (or **Create a New Domain** if your host treats it as a separate domain).
3. Create subdomain:
   - **Subdomain:** `app`
   - **Domain:** `stagepass.co.ke`
   - **Document Root:** e.g. `public_html/app` or `app.stagepass.co.ke` (note this path; you’ll deploy the app here).
4. Click **Create**.
5. (Recommended) In **SSL/TLS** → **Manage SSL**, issue a certificate for `app.stagepass.co.ke` (e.g. AutoSSL or Let’s Encrypt).

---

## Part 2: Decide where each part runs

- **app.stagepass.co.ke** can serve:
  - **Option A:** Only the **Admin Dashboard** (React SPA), with the API at e.g. **api.stagepass.co.ke** (Laravel on another subdomain/folder).
  - **Option B:** **Laravel API + Admin SPA** on the same domain (e.g. `/` = SPA, `/api` = Laravel).

Steps below assume **Option A** (app = admin only; API elsewhere). For Option B you’d point the subdomain’s document root to the Laravel `public` folder and configure Laravel to serve the built SPA and API under the same domain.

---

## Part 3: Server setup (one-time)

### 3.1 PHP (for Laravel, if on same server)

- In cPanel → **Select PHP Version** (or **MultiPHP INI Editor**), choose **PHP 8.1+**.
- Enable extensions Laravel needs: `ctype`, `curl`, `fileinfo`, `json`, `mbstring`, `openssl`, `pdo`, `tokenizer`, `xml`, `bcmath` (and others your app uses).

### 3.2 Node.js (for building the Admin Dashboard)

- In cPanel, open **Setup Node.js App** (or use SSH).
- Create an application:
  - **Node.js version:** 18 or 20 LTS.
  - **Application root:** e.g. `stagepass-app` (or a folder you’ll use only for building).
  - **Application URL:** can be left blank if you only use Node for builds.
- Note the path to the **application root** and to the **npm** binary (e.g. `~/nodevenv/stagepass-app/18/bin/npm`).

If **Setup Node.js App** is not available, use SSH and install Node (e.g. via nvm or system package) and ensure `node` and `npm` are in `PATH` when you run the deploy script.

### 3.3 Composer (for Laravel)

- SSH: run `composer --version`. If missing, install Composer (e.g. [getcomposer.org](https://getcomposer.org/download/)).
- Ensure `composer` is in `PATH` for the user that runs deploys.

---

## Part 4: Create the deploy directory and clone the repo

Use a directory **outside** the subdomain’s document root for the repo (so the web server doesn’t serve raw source).

Example (adjust to your cPanel home path):

```bash
# SSH into the server, then:
cd ~
mkdir -p stagepass
cd stagepass
git clone https://github.com/YOUR_ORG/stagepass-comprehensive.git .   # or your repo URL
```

If you use **cPanel Git™ Version Control**:

1. In cPanel → **Git™ Version Control**.
2. **Create** a new repository:
   - **Repository Path:** e.g. `stagepass/repo`.
   - **Repository Name:** e.g. `stagepass`.
3. **Clone** your remote:
   - **Remote Repository URL:** your Git URL (HTTPS or SSH).
   - Clone into the path above (e.g. `~/stagepass/repo`), then you can use a deploy script that pulls from this clone.

Result: repo at e.g. `~/stagepass/repo` (or `~/stagepass`). Document root for **app.stagepass.co.ke** will point to the **built** admin app (see below).

---

## Part 5: Deploy layout (what goes where)

- **Repository path:** e.g. `~/stagepass/repo` (contains `stagepass/backend/laravel-api`, `stagepass/web/admin-dashboard`, etc.).
- **API (if on same server):** e.g. deploy Laravel to `~/stagepass/api` (document root = `~/stagepass/api/public`) and point **api.stagepass.co.ke** to that.
- **Admin app (app.stagepass.co.ke):** build the SPA and copy output to the subdomain’s document root, e.g. `~/public_html/app` or `~/app.stagepass.co.ke/public_html`.

So:

- **app.stagepass.co.ke** Document Root → `~/public_html/app` (or whatever you set in Part 1).
- Deploy script will: pull repo → build admin dashboard → copy `stagepass/web/admin-dashboard/dist/*` into that document root.

---

## Part 6: Deploy script (CI/CD “pipeline” on the server)

Create a script that: pulls latest code, builds the admin app, and (optionally) restarts Laravel/API. Run this script on demand or from a webhook/cron (CI/CD).

1. SSH to the server (or use cPanel **Terminal**).
2. Create the script (adjust paths to your real paths):

```bash
nano ~/stagepass/deploy.sh
```

Paste (then fix paths and branch name):

```bash
#!/bin/bash
set -e

REPO_DIR="$HOME/stagepass/repo"           # where the repo is cloned
ADMIN_DIR="$REPO_DIR/stagepass/web/admin-dashboard"
DEPLOY_WEBROOT="$HOME/public_html/app"    # app.stagepass.co.ke document root
BRANCH="main"                             # or master

echo "==> Pulling latest..."
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Building Admin Dashboard..."
cd "$ADMIN_DIR"
export NODE_ENV=production
# Use full path to npm if needed, e.g.:
# /usr/bin/npm ci --production=false
# ~/nodevenv/stagepass-app/18/bin/npm run build
npm ci --production=false
npm run build

echo "==> Deploying to app.stagepass.co.ke..."
mkdir -p "$DEPLOY_WEBROOT"
rsync -av --delete "$ADMIN_DIR/dist/" "$DEPLOY_WEBROOT/"

echo "==> Done."
```

3. Make it executable:

```bash
chmod +x ~/stagepass/deploy.sh
```

4. If your host doesn’t have `rsync`, replace the deploy block with:

```bash
rm -rf "$DEPLOY_WEBROOT"/*
cp -R "$ADMIN_DIR/dist/"* "$DEPLOY_WEBROOT/"
```

5. **First-time run:** ensure `ADMIN_DIR` has a valid `package-lock.json` and that `npm run build` succeeds (see “Build and env” below). Run once manually:

```bash
~/stagepass/deploy.sh
```

---

## Part 7: Environment and build (Admin Dashboard)

The admin app uses **VITE_API_URL** for the API base URL.

1. In the repo, create a production env file (or configure on the server so it’s not in Git):

```bash
# On server, in ADMIN_DIR:
nano "$ADMIN_DIR/.env.production"
```

Add (replace with your real API URL):

```env
VITE_API_URL=https://api.stagepass.co.ke/api
```

If the API is on the same domain (e.g. reverse proxy at `/api`):

```env
VITE_API_URL=/api
```

2. Ensure the build reads this file. With Vite, `.env.production` is loaded for `vite build`. Run the build from `ADMIN_DIR` (as in the script).

3. If you use **Option B** (Laravel serves SPA and API on app.stagepass.co.ke), set:

```env
VITE_API_URL=/api
```

and configure Laravel and the web server so `/api` is handled by Laravel.

---

## Part 8: CI/CD trigger (automate deploys)

### Option A: Webhook from GitHub/GitLab (recommended)

1. **Deploy hook URL on the server**
   - Create a small PHP script in a location that’s not inside the public app root (e.g. `~/stagepass/deploy-webhook.php`), or a one-off URL under a path you protect:
   - Script content: run `~/stagepass/deploy.sh` and return 200 (e.g. `shell_exec` or `exec` with full path to the script).
   - **Security:** Require a secret token in the URL or header and validate it in the script. Example:

```php
<?php
// deploy-webhook.php - protect with token
$token = 'YOUR_SECRET_TOKEN';
if (($_GET['token'] ?? '') !== $token) {
    http_response_code(403);
    exit('Forbidden');
}
exec('bash ' . getenv('HOME') . '/stagepass/deploy.sh 2>&1', $out);
header('Content-Type: text/plain');
echo implode("\n", $out);
```

   - Call it with: `https://app.stagepass.co.ke/deploy-webhook.php?token=YOUR_SECRET_TOKEN` (or use a separate subdomain/path and restrict by IP if possible).

2. **GitHub**
   - Repo → **Settings** → **Webhooks** → **Add webhook**.
   - **Payload URL:** your deploy hook URL (with token).
   - **Content type:** application/json.
   - **Events:** Just the push event (or “Send me everything” for testing).
   - Save. On each push, GitHub will call the URL and your server runs the deploy script.

3. **GitLab**
   - **Settings** → **Webhooks** → URL + Secret (validate secret in the script). Choose “Push events”.

### Option B: Cron (pull and deploy on a schedule)

In cPanel → **Cron Jobs**:

- **Minute:** `0`
- **Hour:** `*` (or fixed time, e.g. `2` for 2 AM)
- **Day, Month, Weekday:** `*`
- **Command:**

```bash
/bin/bash $HOME/stagepass/deploy.sh >> $HOME/stagepass/deploy.log 2>&1
```

(Use full paths if cron’s `HOME` differs.)

### Option C: Manual (no automation)

- SSH (or cPanel Terminal) and run:

```bash
~/stagepass/deploy.sh
```

---

## Part 9: If you also deploy the Laravel API on the same server

1. **Deploy directory:** e.g. `~/stagepass/api` with document root `~/stagepass/api/public`.
2. Point **api.stagepass.co.ke** (subdomain) to `~/stagepass/api/public` in cPanel.
3. In the same deploy script (or a second one), after pulling:

```bash
cd "$REPO_DIR/stagepass/backend/laravel-api"
composer install --no-dev --optimize-autoloader
cp .env.example .env   # only first time
# Edit .env (DB, APP_KEY, APP_URL, etc.)
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

4. Set **.env** once: `APP_URL=https://api.stagepass.co.ke`, database credentials, etc.
5. Ensure **storage** and **bootstrap/cache** are writable:  
   `chmod -R 775 storage bootstrap/cache`.

---

## SPA routing (app.stagepass.co.ke)

The Admin Dashboard is a single-page app (React Router). All paths (e.g. `/events/1`, `/reports`) must serve `index.html`. In the **document root** of app.stagepass.co.ke, add **.htaccess** (Apache):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Create this once in the document root (or add it to the repo and copy during deploy).

---

## Part 10: Post-deploy checklist

- [ ] **app.stagepass.co.ke** opens and shows the Stagepass Admin login (no 404).
- [ ] **Browser console:** no mixed-content or CORS errors; API URL is correct (VITE_API_URL).
- [ ] **API:** If separate, **api.stagepass.co.ke** returns expected JSON (e.g. `/api/me` with 401 when not logged in).
- [ ] **SSL:** Both app and API use HTTPS (AutoSSL or your certificate).
- [ ] **PWA:** If you use the admin PWA, the manifest and service worker load from app.stagepass.co.ke (same origin).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create subdomain **app.stagepass.co.ke** in cPanel; set document root. |
| 2 | Enable SSL for app.stagepass.co.ke. |
| 3 | Install/configure PHP 8.1+, Node 18+, Composer. |
| 4 | Clone repo (cPanel Git or SSH) to e.g. `~/stagepass/repo`. |
| 5 | Create **deploy.sh**: pull → `npm ci` + `npm run build` in admin dashboard → rsync/copy `dist/` to document root. |
| 6 | Set **.env.production** (VITE_API_URL) for the admin build. |
| 7 | Run deploy once manually to verify. |
| 8 | Add **webhook** (GitHub/GitLab) or **cron** to run deploy on push or on schedule. |
| 9 | If API is on same server, add Laravel deploy steps and point api.stagepass.co.ke to Laravel’s `public`. |

After this, pushes to your main branch (or cron) will trigger the script and update **app.stagepass.co.ke** with the latest Admin Dashboard build.
