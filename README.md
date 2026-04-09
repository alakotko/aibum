# AI Photo Album Web App for Photographers

A lean, web-native AI photo deliverable platform designed to accelerate professional photographers' workflows. This application automates the most time-consuming aspects of post-production by offering fast album creation, structured client proofing, and a centralized workspace to manage it all—without leaving the browser.

## ✨ Core Features

* **AI Curation & Selection:** Automates technical filtering (blur, blink, exposure detection) and groups similar images.
* **Auto-Draft Album Builder:** Automatically generates complete album spreads from shortlists, featuring a spread-based canvas editor with templates, presets, and manual overrides.
* **Streamlined Client Proofing:** Shareable proof links allowing clients to review, comment, and approve specific spreads with clear version tracking.
* **Rapid Bulk Uploading:** Non-blocking multi-file upload with background processing and thumbnail generation.
* **Studio Workspace:** Role-based access (Owner/Client) and dashboard for managing event projects.

## 🛠️ Technology Stack

* **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19)
* **State Management:** [Zustand](https://zustand-demo.pmnd.rs/) for efficient, client-side UI state.
* **Database & Auth:** [Supabase](https://supabase.com/) for secure multi-tenant persistence and user authentication.
* **AI Engine:** [AWS Rekognition](https://aws.amazon.com/rekognition/) for analyzing image quality and technical filtering.

## 🚀 Getting Started

### Prerequisites

* Node.js v20+
* A Supabase project (for Authentication & PostgreSQL Database)
* An AWS Account (for Rekognition API access)

### Installation

1. **Clone the repository and install dependencies:**

   ```bash
   npm install
   ```

2. **Set up Environment Variables:**

   Create a `.env.local` file in the root directory and ensure the following keys are populated:

   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # AWS Rekognition Configuration
   AWS_REGION=your_aws_region
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   ```

3. **Run the Development Server:**

   ```bash
   npm run dev
   ```

4. **Open the App:**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📈 Roadmap

* **Phase 1 (MVP):** Core upload, AI curation, album builder, and client proofing. *(Current)*
* **Phase 1.5:** Slideshow builder and social media export.
* **Phase 2:** Real-time multiplayer editing, lab/print integrations, white-label galleries, and custom domains.

---

*Designed and engineered for speed, enabling photographers to get from final selection to client approval in record time.*
