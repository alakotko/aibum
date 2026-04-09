# MVP Features: AI Photo Album Web App for Photographers

## Executive Summary

This document defines a lean, validated MVP feature set for a web-first AI photo deliverable platform for professional photographers — a product analogous to SmartAlbums but browser-native, collaborative, and multi-output. Every feature listed is grounded in pain points confirmed by existing tools (SmartAlbums, Pic-Time, FilterPixel, AlbumTeller, and online proofing galleries), not speculative. The MVP is scoped to what photographers will pay for on day one: fast album creation, structured client proofing, and a publishable online gallery.

***

## MVP Scope Rationale

The competitive landscape makes the scope clear. AI culling tools like FilterPixel and Aftershoot demonstrate that photographers will pay specifically to automate the most time-consuming parts of post-production. SmartAlbums shows that an automated first-draft album layout is the core buying trigger. Online proofing galleries confirm that centralized, structured client feedback is a real, paid workflow need — the alternative (email chains) causes delays, miscommunication, and lost payments.[^1][^2][^3][^4][^5][^6]

The MVP therefore targets three linked jobs: **cull + select**, **create album draft**, and **prove + approve with client**. Everything else — slideshows, social exports, white-label — is post-MVP.

***

## MVP Feature Map

### Module 1 — Project & Upload

The project is the fundamental unit. One project = one event/shoot. Everything else lives inside it.

**Core features:**
- Create a new project (name, event type, date, client name)
- Bulk upload JPEG/HEIC/WebP images (drag-and-drop, multi-select, or folder import)
- Background processing with real-time progress indicator (no blocking the UI)
- Auto-extract EXIF metadata: timestamp, orientation, camera, lens, focal length, ISO
- Proxy/thumbnail generation for fast in-browser viewing
- Storage limit per plan tier (MVP: e.g., 2,000 images/project)
- Project list dashboard with cover image, event date, status badge (In Progress / Pending Approval / Approved)

**Why this matters:** Photographers shoot high volumes — a wedding can be 2,000–4,000 raw files. The upload experience must be fast, resumable, and non-blocking or you lose them at the first step.[^4][^1]

***

### Module 2 — AI Curation & Selection

This is the biggest time-saver in the post-production workflow and the clearest AI value proposition.

**Core features:**
- **Technical filter** (auto): detect and tag blur, motion blur, out-of-focus, closed eyes/blinks, and overexposed/underexposed images
- **Duplicate grouping**: burst sequences collapsed into a group; photographer chooses the best frame
- **AI-scored shortlist**: rank images 1–5 by technical quality + composition (AI picks, human reviews)
- **Scene grouping**: cluster images by time gap and visual similarity into labeled moments (e.g., "Ceremony", "First Dance", "Portraits") — photographers can rename or merge groups
- **Accept / Reject / Defer UI**: keyboard-shortcut-friendly review interface (similar to Lightroom's flag system) so reviewing the AI's picks is fast
- **Shortlist export**: photographer saves a "final selection" (e.g., 80 images for album, 120 for gallery) as a named set within the project

**Why this matters:** FilterPixel's cloud-based culling AI achieves over 98.5% accuracy on event galleries and can process 2,740 images in ~17 minutes. Photographers already pay for standalone culling tools, which means embedding this capability inside the album workflow eliminates a tool-switching step and is a genuine differentiator.[^1][^4]

**MVP constraint:** Do not build your own curation model from scratch in v1. Use a third-party AI service (e.g., AWS Rekognition for face/blur detection) or partner API while you gather training data from real photographer workflows.

***

### Module 3 — Album Builder

Auto-layout from a selection is the direct analog to SmartAlbums' core feature. This is the primary reason a photographer would pay for the product.[^6][^7]

**Core features:**
- **Auto-build from selection**: given the approved shortlist, generate a complete album spread draft automatically using layout templates
- **Spread-based canvas editor**: each spread (left + right page) is editable after auto-generation
  - Reorder spreads (drag-and-drop)
  - Swap images within a spread
  - Adjust crop/zoom per image slot
  - Change layout template per spread (e.g., 1-up full bleed, 2+2 grid, hero + 3, etc.)
- **Album style presets**: photographer can define background color, border/gap size, and typography style once and apply globally
- **Cover design**: front cover, back cover, and spine (basic text + image layout)
- **Page count management**: add/remove spreads; show current vs. target page count
- **Spread lock**: lock a finalized spread so it can't be accidentally edited during revisions
- **Annotations/notes per spread**: internal notes for the photographer (not visible to client)

**What NOT to build in MVP:** Free-form drag-and-drop layout of arbitrary elements, text box placement beyond cover title, background pattern libraries. These are polish layers — core value is the auto-layout + fast manual adjustment loop.

**Reference benchmarks:** SmartAlbums auto-builds from metadata and templates. AlbumTeller uses a ReactivePhotos engine for pixel-perfect auto-compositions and chapter-based organization. Both validate that auto-first + manual-edit is the right model.[^7][^6]

***

### Module 4 — Client Proofing

This module is where revenue is protected. A delayed approval = delayed payment.[^2][^3]

**Core features:**
- **Generate proof link**: one-click to create a shareable URL with optional PIN protection
- **Client proof view**: a read-only view of the album spreads, optimized for mobile and desktop (no account required for the client)
- **Client interaction tools:**
  - Heart/favorite a spread
  - Leave a text comment pinned to a specific spread
  - Request a change on a specific spread (flagged in the photographer's dashboard)
  - Approve a spread (green check)
  - Approve the entire album (final sign-off button)
- **Photographer dashboard view**: see which spreads have comments, flags, or approvals; all feedback in one panel
- **Comment resolution**: photographer marks a comment as "resolved" after making the change
- **Version tracking**: when photographer makes revisions and re-shares, the proof link shows "Version 2 / 3" so neither party gets confused
- **Email notification**: client gets an email when the proof is shared; photographer gets a notification when the client comments or approves

**Why this matters:** The alternative to structured proofing — email with screenshots and Dropbox links — is chaotic, error-prone, and unprofessional. SmartAlbums includes cloud proofing as a core feature for exactly this reason. Online proofing tools fundamentally change how approval workflows function by creating a dedicated digital space.[^3][^5][^2][^6]

***

### Module 5 — Online Gallery (Light Version)

A minimal hosted gallery as a delivery output. Not a full gallery platform in MVP — just enough to deliver finished images to the client after approval.

**Core features:**
- Generate a hosted gallery from the approved shortlist (not spreads — individual images)
- Password-protected shareable link
- Client can browse, favorite, and download images (photographer controls download permission)
- Basic gallery layout: masonry or grid, with cover image and event name
- Download quality settings: full-res, web-res, or both
- Expiry date option (gallery auto-expires after N days)

**MVP constraint:** No storefront, no print ordering, no custom domain in v1. These can be added post-MVP once the gallery usage baseline is established.

***

### Module 6 — Studio Workspace & Accounts

The scaffolding that makes all of the above usable for a real business.

**Core features:**
- User account (email + password, plus Google OAuth)
- Studio profile: name, logo, brand color (used in proof links and gallery headers)
- Role system (MVP: two roles only): **Owner** (full access) and **Client** (proof/gallery view via link, no account required)
- Project access control: owner decides which projects are shared with which client link
- Basic billing: Free tier (limited projects/storage) + Pro tier (subscription, more projects, more storage, branded proofs)
- Usage dashboard: projects used, storage used, active proof links

***

## Feature Priority Matrix

| Module | MVP? | Rationale |
|---|---|---|
| Project & Upload | ✅ Core | No product without it |
| AI Curation (technical filter + shortlist) | ✅ Core | Primary time-saving value prop[^1][^4] |
| Scene/moment grouping | ✅ Core | Essential for album narrative logic |
| Album auto-build | ✅ Core | Primary revenue driver, SmartAlbums comparison[^6] |
| Album spread editor | ✅ Core | Photographers need control post-auto-build |
| Client proof link + comments | ✅ Core | Protects revenue, replaces email chaos[^2][^3] |
| Client approval + sign-off | ✅ Core | Closes the proofing loop |
| Version tracking on proofs | ✅ Core | Prevents confusion during revisions[^8] |
| Hosted online gallery (basic) | ✅ Core | Delivery step after approval |
| Slideshow builder | ⏳ v1.5 | Validated need[^9][^10] but not day-one |
| Social media export | ⏳ v1.5 | Nice upsell, not core workflow |
| Real-time multiplayer editing | ⏳ v2 | Needs infrastructure maturity |
| Lab/print integrations | ⏳ v2 | Revenue leverage, but not MVP |
| White-label gallery | ⏳ v2 | Studio branding upsell |
| Custom domain for gallery | ⏳ v2 | Enterprise/premium feature |
| E-commerce / print sales | ⏳ v2 | ShootProof starts at $30/mo for this tier[^11] |

***

## Key UX Principles for MVP

**1. 5-minute first draft guarantee.** The album auto-build for a 80-image wedding selection must complete in under 5 minutes. This is the core promise. If it takes longer, the product fails its pitch.

**2. Keyboard-first culling.** The curation review UI must support keyboard shortcuts (arrow keys, space to pick, X to reject, G to group). Photographers who use Lightroom or Capture One are trained on keyboard-driven workflows.[^12][^4]

**3. Client experience is a first-class surface.** The proof link is the client's only touchpoint with your product. It must be beautiful, mobile-friendly, fast, and require zero technical knowledge. Voice and text comments (as seen in Pixsoffice) lower the barrier for less tech-savvy clients.[^8]

**4. Non-destructive everything.** No action in the editor should be permanent and unrecoverable. Spread edits, image swaps, and album style changes must be undoable. Version history on proofs must be read-only and immutable.[^2]

**5. Don't show photographers their own AI.** The AI curation score and technical rejection reasons are useful for the photographer, but should never be visible to the client. Clients see finished spreads, not AI confidence scores.

***

## MVP Success Metrics

Measure these from day one:

| Metric | Target (3 months post-launch) | Why |
|---|---|---|
| Time to first album draft | < 5 min for 80-photo selection | Core value proposition speed test |
| Curation acceptance rate | > 80% of AI picks kept by photographer | AI quality signal |
| Proof link open rate | > 90% of shared proofs opened by client | Signals proofing UX works |
| Spreads with client comments | Track mean revision rounds | Measures proofing efficiency[^2][^3] |
| Album-to-approval time | Track days from draft to sign-off | Revenue cycle metric |
| Gallery download rate | % of clients who download final files | Delivery completion signal |
| Free → Pro conversion | > 5% in first 90 days | Business viability signal |

***

## Build Sequence Recommendation

**Sprint 1–2:** Upload pipeline, EXIF parsing, proxy generation, project dashboard.

**Sprint 3–4:** AI curation (blur/blink/duplicate detection), shortlist UI with keyboard shortcuts, scene grouping.

**Sprint 5–7:** Album auto-build engine, spread canvas editor, layout templates (start with 8–10 templates).

**Sprint 8–9:** Client proof link, comment system, approval states, version tracking, email notifications.

**Sprint 10:** Hosted gallery (basic), download permissions, expiry, studio branding on proof/gallery.

**Sprint 11–12:** Billing, Free/Pro tiers, usage dashboard, onboarding flow, bug hardening.

This gives you a shippable, paid-tier product in approximately 12 two-week sprints (6 months with a small focused team).

---

## References

1. [Best Photo Culling Software 2026 [Tested & Compared] - FilterPixel](https://app.filterpixel.com/best-photo-culling-software) - FilterPixel is a cloud-based AI photo culling platform built specifically for event photographers wh...

2. [Why an Online Proofing Gallery for Photographers Is Essential for ...reviewstudio.com › blog › why-an-online-proofing-gallery-for-photograp...](https://reviewstudio.com/blog/why-an-online-proofing-gallery-for-photographers-is-essential-for-streamlining-client-reviews/) - An online proofing gallery creates a client-friendly experience for photographers to speed up approv...

3. [How Online Proofing Tools Save Professional Photographers Hours ...](https://www.canonoutsideofauto.ca/2025/11/21/how-online-proofing-tools-save-professional-photographers-hours-every-week/)

4. [Culling Software For Photographers - Which is Best in 2025?](https://adventureweddingacademy.com/culling-software-for-photographers/) - A culling software that uses artificial intelligence to do the image selection for you. ... FilterPi...

5. [The best online picture...](https://filestage.io/blog/online-proofing-photographers/) - Learn how photographers can manage the online proofing process with clients, what the best software ...

6. [Album Design Software for Photographers - SmartAlbums](https://www.smartalbums.com/smartalbums/) - SmartAlbums uses complex algorithms and image metadata to automatically build a beautiful album for ...

7. [AlbumTeller - Album design, Redesigned.](https://albumteller.com) - Albumteller is a life-saving tool for creating photo albums. Thanks to its user-friendly interface a...

8. [Best Online Album Proofing Software for Photographers in 2025 ...](https://www.pixsoffice.com/blog/best-online-album-proofing-software-for-photographers-in-2025-(top-picks)) - Pixsoffice is quickly becoming the go-to album proofing software for photographers in 2025—and for g...

9. [AI Slideshow Builder for Photographers - PhotoAIVideo.com](https://www.photoaivideo.com/ai-slideshow-builder-for-photographers) - Transform your photography portfolio into stunning video slideshows. Perfect for real estate photogr...

10. [Best Free Slideshow App for Creatives & Photographers - Presenti AI](https://presenti.ai/blog/slideshow-app-for-creatives/) - Discover the best free slideshow app for creatives and photographers. Review of 8 top tools includin...

11. [Profitable Photo Subscriptions 2024 - agentX.Agency](https://agentx.agency/posts/2024-11-26-profitable-photo-subscriptions-2024/) - Explore the fascinating world of Profitable Photo Subscriptions 2024.

12. [Fastest AI Photo Culling Tool for Photographers - YouTube](https://www.youtube.com/watch?v=sYkVN4zjVGg) - Tired of spending hours culling wedding or portrait photos? In this video, I'll show you how to cull...

