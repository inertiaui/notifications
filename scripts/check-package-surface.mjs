// Checks the Vue and React package manifests and their built, committed dist files.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const entryFiles = ['inertiaui-notifications.js', 'inertiaui-notifications.d.ts']

const stacks = {
    vue: '@inertiaui/notifications-vue',
    react: '@inertiaui/notifications-react',
}

const fail = (message) => {
    throw new Error(message)
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const manifests = new Map()

for (const [stack, packageName] of Object.entries(stacks)) {
    const packageRoot = join(root, stack)
    const manifest = readJson(join(packageRoot, 'package.json'))
    manifests.set(stack, manifest)

    if (manifest.name !== packageName) {
        fail(`${stack}/package.json must be named ${packageName}.`)
    }

    if (manifest.license !== 'MIT') {
        fail(`${stack}/package.json license must be MIT.`)
    }

    if (manifest.private !== false) {
        fail(`${stack}/package.json must not be private, because the frontend package is published to npm.`)
    }

    if (manifest.repository?.url !== 'git+https://github.com/inertiaui/notifications.git' || manifest.repository?.directory !== stack) {
        fail(`${stack}/package.json repository must point at the ${stack} directory of inertiaui/notifications.`)
    }

    if (JSON.stringify(manifest.files) !== JSON.stringify(['dist', 'shadcn.css', 'theme.css'])) {
        fail(`${stack}/package.json files must contain dist, shadcn.css, and theme.css.`)
    }

    if (manifest.module !== './dist/inertiaui-notifications.js' || manifest.types !== './dist/inertiaui-notifications.d.ts') {
        fail(`${stack}/package.json module and types must point at the built package entrypoints.`)
    }

    const rootExport = manifest.exports?.['.']
    if (rootExport?.import !== manifest.module || rootExport?.types !== manifest.types) {
        fail(`${stack}/package.json exports must match module and types.`)
    }

    if (
        manifest.exports?.['./theme.css'] !== './theme.css' ||
        manifest.exports?.['./shadcn.css'] !== './shadcn.css' ||
        JSON.stringify(manifest.sideEffects) !== JSON.stringify(['*.css'])
    ) {
        fail(`${stack}/package.json must export theme.css and shadcn.css and preserve CSS side effects.`)
    }

    const distFiles = readdirSync(join(packageRoot, 'dist'))
    for (const name of entryFiles) {
        const file = join(packageRoot, 'dist', name)
        if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size === 0) {
            fail(`Missing or empty package file: ${stack}/dist/${name}`)
        }
    }

    for (const name of distFiles) {
        if (!entryFiles.includes(name) && !/^[\w-]+-[\w-]+\.js$/.test(name)) {
            fail(`${stack}/dist contains an unexpected artifact: ${name}`)
        }
        const contents = readFileSync(join(packageRoot, 'dist', name), 'utf8')
        if (/(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/.test(contents)) {
            fail(`${stack}/dist/${name} contains an absolute build-machine path.`)
        }
        if (name.endsWith('.d.ts') && /(?:from\s+|import\()['"][^'"]*(?:\.\.\/|\/src\/)/.test(contents)) {
            fail(`${stack}/dist/${name} references a repository-internal path.`)
        }
        for (const [, dependency] of contents.matchAll(/(?:from\s*|import\s*\()['"]\.\/([^'"]+\.js)['"]/g)) {
            if (!distFiles.includes(dependency)) {
                fail(`${stack}/dist/${name} references missing chunk ${dependency}`)
            }
        }
    }

    const packed = JSON.parse(execFileSync('pnpm', ['--dir', stack, 'pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' }))
    const files = packed.files.map(({ path }) => path).sort()
    // pnpm also packs the workspace root LICENSE.md.
    const expectedFiles = ['LICENSE.md', 'package.json', 'shadcn.css', 'theme.css', ...distFiles.map((name) => `dist/${name}`)].sort()

    if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
        fail(`${stack} package contains unexpected files:\n${files.map((file) => `  - ${file}`).join('\n')}`)
    }
}

if (manifests.get('vue').version !== manifests.get('react').version) {
    fail(`Vue package version ${manifests.get('vue').version} must match React package version ${manifests.get('react').version}.`)
}

// The shared core imports @inertiaui/vanilla, and its cn.ts imports tailwind-merge, so both packages accept the same versions of them.
for (const dependency of ['@inertiaui/vanilla', 'tailwind-merge']) {
    const vueRange = manifests.get('vue').dependencies?.[dependency]
    const reactRange = manifests.get('react').dependencies?.[dependency]

    if (vueRange === undefined || vueRange !== reactRange) {
        fail(`Vue and React must depend on the same range of ${dependency}, not ${vueRange ?? 'none'} and ${reactRange ?? 'none'}.`)
    }
}

const vueInertiaRange = manifests.get('vue').peerDependencies?.['@inertiajs/vue3']
const reactInertiaRange = manifests.get('react').peerDependencies?.['@inertiajs/react']

if (vueInertiaRange === undefined || vueInertiaRange !== reactInertiaRange) {
    fail(`The @inertiajs/vue3 peer range ${vueInertiaRange ?? 'none'} must match the @inertiajs/react peer range ${reactInertiaRange ?? 'none'}.`)
}

if (readFileSync(join(root, 'vue/theme.css'), 'utf8') !== readFileSync(join(root, 'react/theme.css'), 'utf8')) {
    fail('Vue and React must ship the same theme tokens.')
}

if (readFileSync(join(root, 'vue/shadcn.css'), 'utf8') !== readFileSync(join(root, 'react/shadcn.css'), 'utf8')) {
    fail('Vue and React must ship the same shadcn/ui preset.')
}

if (readFileSync(join(root, 'vue/src/classes.ts'), 'utf8') !== readFileSync(join(root, 'react/src/classes.ts'), 'utf8')) {
    fail('Vue and React must use the same class names.')
}

// The packages export the same core, so their bundled types export the same names, apart from React's prop types.
const reactOnlyExports = [
    'IconComponent',
    'ToasterProps',
    'NotificationCenterProps',
    'NotificationListProps',
    'NotificationPreferencesProps',
    'ToastRenderHelpers',
]
const exportedNames = (stack) => {
    const types = readFileSync(join(root, stack, 'dist/inertiaui-notifications.d.ts'), 'utf8')
    const declared = [...types.matchAll(/^export declare (?:abstract )?(?:const|let|var|function|class|interface|type|enum|namespace) ([\w$]+)/gm)].map(
        ([, name]) => name,
    )
    // The last word of each name in an `export { … }` list, which drops `type` and takes the alias of `name as alias`.
    const listed = [...types.matchAll(/^export (?:type )?\{([^}]*)\}/gm)].flatMap(([, names]) =>
        [...names.matchAll(/([\w$]+)\s*(?:,|$)/g)].map(([, name]) => name),
    )
    const names = new Set([...declared, ...listed])

    if (names.size === 0) {
        fail(`${stack}/dist/inertiaui-notifications.d.ts exports nothing that this check recognizes.`)
    }

    return names
}
const vueExports = exportedNames('vue')
const reactExports = exportedNames('react')
const onlyVue = [...vueExports].filter((name) => !reactExports.has(name))
const onlyReact = [...reactExports].filter((name) => !vueExports.has(name) && !reactOnlyExports.includes(name))

if (onlyVue.length > 0 || onlyReact.length > 0) {
    fail(`Vue and React must export the same names. Only Vue exports: ${onlyVue.join(', ') || 'none'}. Only React exports: ${onlyReact.join(', ') || 'none'}.`)
}

console.log(`Package surfaces are valid at version ${manifests.get('vue').version}.`)
