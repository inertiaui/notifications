# Inertia Notifications

Toasts, a notification center, and notification preferences for Laravel + Inertia.js, with Vue and React components.

Inertia Notifications is part of [Inertia UI](https://inertiaui.com), a suite of packages designed for Laravel, Inertia.js, and Tailwind CSS.

You may find the documentation at [https://inertiaui.com/inertia-notifications/docs](https://inertiaui.com/inertia-notifications/docs).

## Sponsor Us

[<img src="https://inertiaui.com/visit-card.jpg" />](https://inertiaui.com/inertia-table?utm_source=github&utm_campaign=inertia-notifications)

❤️ We proudly support the community by developing Laravel packages and giving them away for free. Please consider [sponsoring the maintenance and development](https://github.com/sponsors/pascalbaljet) when this package saves you time or you rely on it professionally, and check out our premium packages: [Inertia Table](https://inertiaui.com/inertia-table?utm_source=github&utm_campaign=inertia-notifications) and [Inertia Forms](https://inertiaui.com/inertia-forms?utm_source=github&utm_campaign=inertia-notifications). Keeping track of issues and pull requests takes time, but we're happy to help!

## Changelog

Please see [CHANGELOG](CHANGELOG.md) for more information on what has changed recently.

## Contributing

The repository is a monorepo with the PHP package in `src/`, shared framework-agnostic TypeScript in `js/`, two JS libraries in `vue/` (`@inertiaui/notifications-vue`) and `react/` (`@inertiaui/notifications-react`), VitePress documentation in `docs/`, and a Laravel demo app in `demo-app/` that consumes the packages through a Composer path repository and pnpm workspaces.

Supported versions: PHP 8.3+, Laravel 12 or 13, Inertia.js 3.11+ with Inertia Laravel 3.8+, Vue 3.5+, React 19, Tailwind CSS 4.3+.

The built `vue/dist` and `react/dist` folders are committed: the frontend packages ship inside the Composer package, so consumers install them from `vendor/inertiaui/notifications/{vue,react}` without building the source. Rebuild them with `pnpm build` and commit them with the source changes. CI fails when they are out of date. The same packages are also published to npm.

### Releasing

Run `./release.sh 1.2.3` from an up-to-date `main`. The script checks CI, bumps the Vue and React package versions, runs `composer build`, commits the versions and builds, pushes a tag, and creates a GitHub release with notes generated from the merged pull requests. The `Update Changelog` workflow then adds those notes to `CHANGELOG.md` and commits it to `main`, so you don't edit the changelog by hand. The release publishes both packages to npm through the `Publish to npm` workflow, and Packagist picks up the tag.

The Boost skill in `resources/boost` repeats each page of the docs for AI agents, as one reference file per page. The reference files and their list in `SKILL.md` are generated: run `pnpm docs:guide` after changing a page, and commit the result with the docs. CI fails when they are out of date.

### Setup

```bash
composer install
pnpm install
pnpm build
cd demo-app
composer install
cp .env.example .env
php artisan key:generate
php artisan inertia-notifications:vapid --subject=mailto:you@your-app.com
```

Then create the demo app's SQLite database with sample notifications:

```bash
php artisan migrate --seed
```

Every demo request is signed in as a demo user, so the notification center works without a login page. In an Amp orb, `.agents/setup` installs the toolchain and dependencies, creates the database, and builds everything.

### Development

From the repository root:

```bash
pnpm dev:vue          # Watch & rebuild the Vue library
pnpm dev:demo:vue     # Vue demo Vite server
pnpm dev:react        # Watch & rebuild the React library
pnpm dev:demo:react   # React demo Vite server
pnpm docs:dev         # Documentation
```

From `demo-app/`, run `APP_STACK=vue php artisan serve --port=8100` or `APP_STACK=react php artisan serve --port=8101` for the matching Laravel server. In an Amp orb, `amp orb services ensure` starts both servers with the built demo assets, and the docs dev server, from `.amp/services.yaml`.

### Quality Checks

From the repository root:

```bash
composer metadata:check   # composer validate --strict
composer analyse          # PHPStan level 5
composer format:check     # Laravel Pint and PHP CS Fixer
composer refactor:check   # Rector dry run
composer test             # Pest package tests
pnpm lint:check           # Oxlint
pnpm format:check         # Oxfmt
pnpm test:unit            # Vitest unit tests for js/
pnpm typecheck            # Vue and React packages
pnpm docs:guide:check     # Boost guide matches the docs
composer all              # All of the above
pnpm typecheck:demo       # Vue and React demo code
composer build            # all + typecheck:demo, library/demo/docs builds, and package checks
```

The package tests run on an in-memory SQLite database. You may run them on MySQL or PostgreSQL, as CI does, by setting the connection in the environment. `DB_HOST` and `DB_PORT` default to `127.0.0.1` and the port of the database:

```bash
DB_CONNECTION=pgsql DB_DATABASE=testing DB_USERNAME=testing DB_PASSWORD=secret composer test
```

### Browser Tests

The demo app runs Pest Browser tests against the built assets of the stack in `APP_STACK`. Build the library and demo assets for that stack first, and install Chromium once with `pnpm --dir demo-app exec playwright install chromium`.

```bash
pnpm build:vue && pnpm --filter demo-app build:vue
cd demo-app && APP_STACK=vue vendor/bin/pest

pnpm build:react && pnpm --filter demo-app build:react
cd demo-app && APP_STACK=react vendor/bin/pest
```

## Security Vulnerabilities

Please send an e-mail to Pascal Baljet via [pascal@protone.media](mailto:pascal@protone.media) when you discover a security vulnerability within Inertia UI. All security vulnerabilities will be promptly addressed.

## Credits

- [Pascal Baljet](https://github.com/protonemedia)

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
