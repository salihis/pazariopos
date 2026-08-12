// deploy/ecosystem.config.cjs
// ─────────────────────────────────────────────────────────────
// PM2 process config for the Fastify server in production.
// .cjs extension is deliberate: root package.json has "type":
// "module" (added for eslint.config.js), but PM2's config loader
// expects CommonJS — .cjs opts this one file out of that.
//
// USAGE (see deploy/README.md for the full walkthrough):
//   cd /var/www/pazariopos
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save                    # persist the process list
//   pm2 startup                 # print the systemd command to run
//                                # ONCE so PM2 (and this app) survives
//                                # a server reboot
// ─────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name: 'pazariopos-server',
      cwd: './server',
      // dotenv (loaded first thing in src/main.ts — see that file's
      // top comment) reads server/.env relative to this cwd, so
      // server/.env must exist on the VPS. It's never committed to
      // git (see .gitignore) — copy it from server/env.example and
      // fill in real production values (see deploy/README.md step 4).
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      // Keep a bounded amount of log history rather than letting these
      // grow forever — pm2-logrotate (deploy/README.md step 8) handles
      // rotation on top of this.
      error_file: '../logs/server-error.log',
      out_file: '../logs/server-out.log',
      time: true,
    },
  ],
}
