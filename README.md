# BR MAX Platform

BR MAX is a media automation platform built with Next.js and Remotion for generating, previewing, and publishing dynamic video content on demand. The project combines a modern React front end with server-side rendering, cloud-ready encoding workflows, and integrations for authentication and storage.

## Key Features
- **Programmatic video creation** powered by [Remotion](https://www.remotion.dev/), enabling reusable video compositions and automated renders.
- **Next.js 15 application** with App Router, server components, and client interactivity for a responsive user experience.
- **Authentication ready** via Clerk, allowing secure access control for dashboards and rendering tools.
- **Cloud-native rendering** hooks for AWS Lambda through `@remotion/lambda`, making it simple to scale video encoding jobs.
- **Storage integration** using Supabase and AWS S3 clients for asset management and render outputs.
- **Tailwind CSS design system** with Framer Motion animations to deliver polished UI components.

## Project Structure
- `src/` – Application source files, including routes, UI components, and video compositions.
- `public/` – Static assets served directly by Next.js.
- `styles/` – Global styling, Tailwind utilities, and configuration overrides.
- `remotion.config.ts` – Remotion-specific configuration for rendering pipelines.
- `config.mjs` & `deploy.mjs` – Scripts for configuring and deploying AWS Lambda render infrastructure.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example`, filling in Clerk, Supabase, AWS, and Remotion credentials.
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the Remotion Studio to preview compositions:
   ```bash
   npm run remotion
   ```

## Admin Route (/a)
- Set `ADMIN_DASHBOARD_PASSWORD` in `.env` to enable the locked `/a` route.
- When `/a` loads it displays a session nonce. Build the one-time password in the format `ADMIN_DASHBOARD_PASSWORD:NONCE`.
- Entering the computed password unlocks a full snapshot of render jobs, users, token transactions, and render errors. The nonce expires immediately after a successful unlock, so reload the route for a new password.

## Rendering Workflows
- **Local renders:**
  ```bash
  npm run render
  ```
- **AWS Lambda deployment:**
  ```bash
  node deploy.mjs
  ```
  Run this after changing video templates, updating `config.mjs`, or upgrading Remotion.

## Testing & Quality
- Lint the project using the built-in Next.js ESLint configuration:
  ```bash
  npm run lint
  ```
- Type-check with TypeScript (implicit via Next.js build). Add `npm run build` in CI to ensure type safety and production readiness.

## Contributing Guidelines
1. Fork and clone the repository.
2. Create a feature branch: `git checkout -b feature/my-update`.
3. Make your changes and add tests when applicable.
4. Run linting and build checks before submitting a pull request.
5. Open a PR with a clear description of the changes and screenshots or videos when relevant.

## Deployment Notes
- Ensure AWS credentials used for Remotion Lambda have permissions to deploy and invoke the configured functions.
- Keep an eye on Remotion version alignment across packages when upgrading dependencies.
- Configure the CDN or hosting provider (Vercel, Netlify, etc.) to cache static assets effectively.

## Support
For issues or feature requests, open a GitHub issue or contact the BR MAX engineering team.

## Roadmap & TODO
- [ ] Document Supabase schema and migrations.
- [ ] Add automated integration tests for rendering workflows.
- [ ] Set up CI/CD pipeline with deployment previews.
- [ ] Polish onboarding documentation for new contributors.


Used to deploy function: npx remotion lambda functions deploy --timeout 900 --region ap-south-1
remotion-render-4-0-373-mem2048mb-disk2048mb-120sec
Used to deploy site: npx remotion lambda sites create src/remotion/index.ts --site-name=br-max --region ap-south-1



User's eleven lab key needs to have these premissions:
user_read (to check their concurrent limit)
voices_read (to validate if they have enough space)
text_to_speech (for tts)