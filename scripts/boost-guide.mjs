// Writes a reference file of the Boost skill for each page of the docs, and their list in the skill, or checks that
// they are up to date with --check.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { docsSections } from '../docs/.vitepress/sections.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const skillPath = join(root, 'resources/boost/skills/inertia-notifications-development')
const referencesPath = join(skillPath, 'references')
const docsUrl = 'https://inertiaui.com/inertia-notifications/docs'
const listStart = '<!-- The list below is generated from the docs with `pnpm docs:guide`. Edit the docs instead. -->'
const listEnd = '<!-- End of the generated list. -->'

// A page becomes one file next to the others, named after its path, such as `toasts-actions.md`.
const fileName = (link) => `${link.slice(1).replaceAll('/', '-')}.md`

const pages = docsSections.flatMap(({ name, items }) =>
    items.map(({ text, link }) => {
        const source = readFileSync(join(root, 'docs', `${link.slice(1)}.md`), 'utf8')

        return {
            section: name,
            text,
            link,
            file: fileName(link),
            description: /^---\n[\s\S]*?^description: (.+)$/m.exec(source)?.[1] ?? '',
            lines: source
                .replace(/^---\n[\s\S]*?\n---\n+/, '')
                // The page's imports and its live examples only render on the docs site.
                .replace(/^<script setup>\n[\s\S]*?\n<\/script>\n+/, '')
                .replace(/^<DocsExample[^>]*>\n[\s\S]*?\n<\/DocsExample>\n+/gm, '')
                .trimEnd()
                .split('\n'),
        }
    }),
)

const files = new Map(pages.map(({ link, file }) => [link, file]))

// A link to another page leads to its file, so the agent never has to leave the skill.
const target = (path) => {
    const [link, anchor] = path.split('#')

    return files.has(link) ? `${files.get(link)}${anchor === undefined ? '' : `#${anchor}`}` : `${docsUrl}${path}`
}

// The comment that names a tab of a code group, in the language of its code block.
const tabComments = new Map([
    ['vue', (name) => `<!-- ${name} -->`],
    ['css', (name) => `/* ${name} */`],
    ['bash', (name) => `# ${name}`],
])
const tabComment = (language, name) => tabComments.get(language)?.(name) ?? `// ${name}`

const convert = ({ link, lines }) => {
    const output = [`<!-- Generated from docs${link}.md with \`pnpm docs:guide\`. Edit the docs instead. -->`, '']
    let fenced = false

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index]

        if (line.startsWith('```')) {
            // A tab of a code group becomes a code block that names the tab in a comment on its first line.
            const tab = fenced ? null : /^```(\S*) \[(.+)\]$/.exec(line)
            fenced = !fenced
            output.push(...(tab ? [`\`\`\`${tab[1]}`, tabComment(tab[1], tab[2])] : [line]))
        } else if (fenced) {
            output.push(line)
        } else if (line === '::: code-group' || line === ':::') {
            index += lines[index + 1] === '' ? 1 : 0
        } else {
            output.push(line.replace(/\]\((\/[^)\s]*)\)/g, (_, path) => `](${target(path)})`))
        }
    }

    return `${output.join('\n')}\n`
}

const list = docsSections
    .map(({ name }) => [
        `### ${name}`,
        '',
        ...pages.filter(({ section }) => section === name).map(({ text, file, description }) => `- [${text}](references/${file}): ${description}`),
    ])
    .map((lines) => lines.join('\n'))
    .join('\n\n')

const skillFile = join(skillPath, 'SKILL.md')
const skill = readFileSync(skillFile, 'utf8')
// Agents choose a skill by its description, which the Agent Skills format limits to 1,024 characters.
const skillDescription = /^---\n[\s\S]*?^description: (.+)$/m.exec(skill)?.[1] ?? ''

if (skillDescription.length > 1024) {
    throw new Error(`The description of the skill has ${skillDescription.length} characters, more than the 1,024 that skills allow.`)
}

const start = skill.indexOf(listStart)
const end = skill.indexOf(listEnd)

if (start === -1 || end < start) {
    throw new Error(`The skill must contain the lines:\n${listStart}\n${listEnd}`)
}

const expected = new Map([
    [skillFile, `${skill.slice(0, start + listStart.length)}\n\n${list}\n\n${skill.slice(end)}`],
    ...pages.map((page) => [join(referencesPath, page.file), convert(page)]),
])

// A file of a page that the docs no longer have, or of the old single guide, is removed.
const stale = readdirSync(referencesPath)
    .map((file) => join(referencesPath, file))
    .filter((file) => file.endsWith('.md') && !expected.has(file))

const outdated = [...expected].filter(([file, content]) => !existsSync(file) || readFileSync(file, 'utf8') !== content)

if (!process.argv.includes('--check')) {
    outdated.forEach(([file, content]) => writeFileSync(file, content))
    stale.forEach((file) => rmSync(file))
} else if (outdated.length > 0 || stale.length > 0) {
    console.error('The Boost skill is out of date with the docs. Run `pnpm docs:guide` and commit the result.')
    process.exit(1)
} else {
    console.log('The Boost skill is up to date with the docs.')
}
