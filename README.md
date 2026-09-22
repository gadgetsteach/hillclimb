# 🏎️ Hill Climb Racing — High-Performance Physics Web Game

[![Angular](https://img.shields.io/badge/Angular-21.2-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Matter.js](https://img.shields.io/badge/Matter.js-2D_Physics-4B8BBE?style=for-the-badge)](https://brm.io/matter-js/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-Unit_Tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas_60FPS-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

A browser-based, high-performance 2D physics-driven hill climbing game built with **Angular 21 (Standalone Components & Signals)**, **Matter.js** rigid body physics, and hardware-accelerated **HTML5 Canvas** rendering.

---

## 📖 Table of Contents

- [Key Architecture & Features](#-key-architecture--features)
- [Local Setup & Development](#-local-setup--development)
- [How to Play & Controls](#-how-to-play--controls)
- [Automated Testing](#-automated-testing)
- [AI Prompts Used to Build the Game](#-ai-prompts-used-to-build-the-game)
- [Deployment Guide (5+ Hosting Providers)](#-deployment-guide-5-hosting-providers)
  - [1. Vercel](#1-vercel)
  - [2. Netlify](#2-netlify)
  - [3. GitHub Pages](#3-github-pages)
  - [4. Firebase Hosting](#4-firebase-hosting)
  - [5. Cloudflare Pages](#5-cloudflare-pages)
  - [6. Docker & Nginx (Bonus)](#6-docker--nginx-self-hosted)

---

## ⚡ Key Architecture & Features

1. **Angular `NgZone` Isolation (Locked 60 FPS)**:
   - Physics integration (`Matter.Engine.update`) and canvas rendering run completely outside Angular's change-detection cycle using `NgZone.runOutsideAngular()`.
   - UI Signals (fuel gauge, speedometer, RPM gauge, coins, distance) synchronize at a throttled 20 Hz, preventing frame rate drops and micro-stutters.

2. **Vehicle Engineering & Suspension Dynamics**:
   - **Chassis Body**: Custom polygonal off-road buggy with roll-cage and exhaust piping.
   - **Wheels**: Two circular rigid bodies with high friction and static traction.
   - **Critically Damped Suspension**: `Matter.Constraint` spring links with tuned stiffness and damping to prevent violent bounce-backs or chassis bottoming-out.
   - **Ragdoll Driver Crash Hitbox**: Pinned driver head hitbox detects terrain collisions and triggers instant crash sequences.

3. **Procedural Multi-Harmonic Terrain with Chunk Recycling**:
   - Continuous mathematical elevation using multi-octave harmonic sine functions that generate rolling hills, dips, and steep peaks.
   - 1600px dynamic chunk generation ahead of the camera with automatic destruction of off-screen chunks behind to maintain constant low memory usage.
   - Procedurally spawned gold coin bundles (+5, +25, +50) and red emergency fuel canisters (+45%).

4. **Air Control & Stunt Bonanza**:
   - Active airborne state detection applies rotational chassis torque when pressing Gas or Brake.
   - Continuous 360° rotation tracker awarding `BACKFLIP!` and `FRONTFLIP!` bonuses (+500 coins) with celebration toasts.

5. **Persistent Tuning Garage**:
   - Saves coin balance, high scores, and upgrade levels in `localStorage`:
     - **Engine**: Boosts peak horsepower and hill-climbing torque.
     - **Suspension**: Improves shock absorption, spring damping, and rollover stability.
     - **Tires**: High-traction competition rubber for steep inclines.
     - **4WD Drivetrain**: Balances torque delivery to the front axle for vertical climbs.

6. **Web Audio Procedural Sound Engine**:
   - Zero external audio assets! Pure procedural sound via Web Audio API:
     - Dynamic engine throttle rev with RPM pitch shifting
     - Coin collection harmonic chimes
     - Fuel refill ascending arpeggios
     - Crash impact crunch and low-end thud

---

## 💻 Local Setup & Development

### Prerequisites
- **Node.js**: `v18.19.0` or higher (Node 20+ recommended)
- **npm**: `v9.0.0` or higher

### Step 1: Clone the Repository
```bash
git clone https://github.com/gadgetsteach/hillclimb.git
cd hillclimb
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run the Development Server
```bash
npm start
# or
ng serve
```
Open your browser and navigate to:
```
http://localhost:4200/
```
The application will automatically reload if you modify any source files.

### Step 4: Build for Production
```bash
npm run build
```
Production build artifacts will be generated in `dist/hillclimb/browser/`.

---

## 🎮 How to Play & Controls

| Action | Keyboard Keys | On-Screen Pedals | Description |
| :--- | :--- | :--- | :--- |
| **GAS / ACCEL** | <kbd>→</kbd> / <kbd>D</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> | **GAS** (Right Green Pedal) | **Ground:** Accelerates forward & climbs hills.<br>**Air:** Tilts nose-DOWN (Frontflip). |
| **BRAKE / REVERSE** | <kbd>←</kbd> / <kbd>A</kbd> / <kbd>↓</kbd> / <kbd>S</kbd> / <kbd>Space</kbd> | **BRAKE** (Left Red Pedal) | **Ground:** Brakes & shifts into reverse.<br>**Air:** Tilts nose-UP (Backflip). |
| **PAUSE** | <kbd>P</kbd> | Top HUD Pause Button | Pauses / resumes physics and engine audio. |
| **RESTART** | <kbd>R</kbd> | Game Over / Pause Button | Instantly restarts run from 0m. |
| **HOW TO PLAY** | <kbd>H</kbd> or <kbd>?</kbd> | Top HUD `❓` Button | Opens interactive controls guide and driving hints. |
| **GARAGE** | — | Top HUD `🔧 GARAGE` Button | Opens vehicle upgrade workshop. |

### Pro Driving Tips
- 💥 **Head Protection:** If the driver's head touches the ground, you crash! Use air tilt to align wheels with the hill slope before touchdown.
- ⛽ **Fuel Canisters:** Fuel constantly drains (faster when accelerating). Collect red canisters (+45% fuel) to prevent engine cutoff.
- 🔄 **Stunt Flips:** Rotate 360° in mid-air to score +500 coins instantly.
- 🛞 **Feather Throttle:** On steep cliffs, tap gas gently to maintain traction rather than burning rubber.

---

## 🧪 Automated Testing

The project includes unit tests for physics mechanics, state management, and UI component behavior powered by **Vitest**:

```bash
npm test -- --watch=false
```

### Test Suites (24/24 Tests Passing)
- `src/app/services/game-state.service.spec.ts`: Coins, high score, upgrades purchasing, and persistence.
- `src/app/game/game-engine.spec.ts`: Matter.js vehicle bodies, suspension constraints, terrain chunking, fuel consumption, and crash detection.
- `src/app/app.spec.ts`: Game loop initialization, pedal states, keyboard listeners, pause/garage/help modals, and run restarts.

---

## 🤖 AI Prompts Used to Build the Game

Here are the prompts used to architect the physics engine and generate 2D visual assets:

### 1. Architectural & Engineering Prompt
> *"Building a high-performance, physics-driven web game in Angular requires strict separation of concerns. If you try to bind physics calculations directly to Angular's UI templates, the framework's change detection cycle will throttle your frame rate, and the game will stutter.*
>
> *Use Angular 17+ (standalone components & signals), HTML5 Canvas, Matter.js 2D rigid body physics, and localStorage persistence. Run the game loop outside Angular's NgZone using requestAnimationFrame. Build a critically damped suspension system with three bodies (chassis, two wheels) and spring constraints. Generate endless procedural terrain using multi-octave harmonic sine noise with chunk recycling. Implement air torque control for 360° backflips/frontflips and head-hitbox crash detection."*

### 2. Asset Prompt A — Parallax Backgrounds
> *"A 2D side-scrolling video game background, seamless looping vector art style, flat colors, clean edges. Distant silhouettes of rolling hills and pine trees against a bright dusk sky, layered atmospheric perspective. In the style of modern casual indie mobile games, 16:9 ratio, no text, no characters."*

### 3. Asset Prompt B — The Vehicle (Chassis & Wheels)
> *"A side-view 2D illustration of a rusty, rugged off-road jeep, mobile game asset style, flat vector shading, thick bold outlines. The wheels are clearly separated from the main chassis. Cartoonish proportions with an oversized engine block and a roll cage. Isolated on a solid white background."*

### 4. Asset Prompt C — The Driver Character (Ragdoll)
> *"2D character sprite, side profile, a scruffy cartoon hillbilly driver wearing a cap and goggles, sitting position with hands stretched out holding an invisible steering wheel. Vector art, flat shading, thick outlines, casual mobile game UI style, isolated on a white background."*

### 5. Asset Prompt D — UI Elements & Collectibles
> *"A UI sprite sheet for a 2D mobile racing game. Includes a bright gold coin with a star icon, a red plastic gas can with a fuel drop icon, and glossy green 'Upgrade' buttons. Vector illustration, shiny gradients, thick strokes, isolated on a white background."*

---

## 🚀 Deployment Guide (5+ Hosting Providers)

Before deploying to any platform, create the production build:
```bash
npm run build
```
The production bundle will be located at:
```
dist/hillclimb/browser/
```

Here are **5 popular ways** to host and deploy this Angular application:

---

### 1. Vercel

Vercel provides automatic deployments and edge routing for Angular projects.

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy production build
vercel --prod
```

#### Option B: Connecting Git Repository
1. Push your code to GitHub, GitLab, or Bitbucket.
2. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your `hillclimb` repository.
4. Configure Project Settings:
   - **Framework Preset:** Angular
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist/hillclimb/browser`
5. Click **Deploy**.

#### Single Page App (SPA) Routing Configuration
Create a `vercel.json` file in the project root:
```json
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

---

### 2. Netlify

Netlify offers fast global CDN delivery and continuous deployment from Git.

#### Option A: Using Netlify CLI
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build project
npm run build

# Deploy production directory
netlify deploy --prod --dir=dist/hillclimb/browser
```

#### Option B: Connecting Git Repository
1. Log in to [Netlify](https://www.netlify.com/) and choose **"Add new site" -> "Import an existing project"**.
2. Select your repository.
3. Configure settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist/hillclimb/browser`
4. Click **Deploy hillclimb**.

#### Single Page App (SPA) Rewrite Rule
Create `public/_redirects` or `dist/hillclimb/browser/_redirects`:
```
/*    /index.html   200
```
Or create a `netlify.toml` in your root:
```toml
[build]
  command = "npm run build"
  publish = "dist/hillclimb/browser"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### 3. GitHub Pages

Host your game free directly on GitHub.

#### Option A: Using `angular-cli-ghpages`
```bash
# 1. Install deployment package
npm i -D angular-cli-ghpages

# 2. Build with your GitHub repo base-href
ng build --base-href="https://<YOUR-USERNAME>.github.io/<REPO-NAME>/"

# 3. Publish to gh-pages branch
npx angular-cli-ghpages --dir=dist/hillclimb/browser
```

#### Option B: Automated GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Application
        run: npm run build -- --base-href="/${{ github.event.repository.name }}/"

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist/hillclimb/browser
          branch: gh-pages
```

---

### 4. Firebase Hosting

Google Cloud / Firebase provides ultra-fast global SSD hosting with free SSL.

```bash
# 1. Install Firebase CLI
npm i -g firebase-tools

# 2. Login to Google account
firebase login

# 3. Initialize Firebase Hosting in project root
firebase init hosting
```
During initialization:
- **What do you want to use as your public directory?** `dist/hillclimb/browser`
- **Configure as a single-page app (rewrite all urls to /index.html)?** `Yes`
- **Set up automatic builds and deploys with GitHub?** `Yes / No` (optional)

```bash
# 4. Build and Deploy
npm run build
firebase deploy --only hosting
```

Your game will immediately be live at `https://<PROJECT-ID>.web.app`.

---

### 5. Cloudflare Pages

Cloudflare Pages provides zero-latency edge delivery on Cloudflare's global network.

#### Option A: Using Wrangler CLI
```bash
# Install Wrangler CLI
npm i -g wrangler

# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist/hillclimb/browser --project-name=hillclimb
```

#### Option B: Cloudflare Dashboard Git Integration
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Compute (Workers) -> Pages**.
2. Click **Connect to Git** and pick the `hillclimb` repository.
3. Configure Build Settings:
   - **Framework preset:** Angular
   - **Build command:** `npm run build`
   - **Build output directory:** `dist/hillclimb/browser`
4. Click **Save and Deploy**.

#### SPA Fallback Routing
Create `public/_routes.json` or configure Cloudflare Pages fallback rule so all client routes redirect to `/index.html`.

---

### 6. Docker & Nginx (Self-Hosted)

For custom VPS hosting (AWS EC2, DigitalOcean, Hetzner, GCP), deploy using a lightweight Nginx Alpine container.

#### 1. Create `nginx.conf`
```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### 2. Create `Dockerfile`
```dockerfile
# Stage 1: Build Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist/hillclimb/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. Build and Run Container
```bash
# Build Docker image
docker build -t hillclimb-game .

# Run container on port 8080
docker run -d -p 8080:80 --name hillclimb hillclimb-game
```
Access the game at `http://localhost:8080`.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
