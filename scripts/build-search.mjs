import { slugifyWithCounter } from '@sindresorhus/slugify'
import glob from 'fast-glob'
import * as fs from 'fs'
import { toString } from 'mdast-util-to-string'
import * as path from 'path'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { filter } from 'unist-util-filter'
import { SKIP, visit } from 'unist-util-visit'

const processor = remark().use(remarkMdx).use(extractSections)
const slugify = slugifyWithCounter()

function isObjectExpression(node) {
  return (
    node.type === 'mdxTextExpression' &&
    node.data?.estree?.body?.[0]?.expression?.type === 'ObjectExpression'
  )
}

function excludeObjectExpressions(tree) {
  return filter(tree, (node) => !isObjectExpression(node))
}

function extractSections() {
  return (tree, { sections }) => {
    slugify.reset()

    visit(tree, (node) => {
      if (node.type === 'heading' || node.type === 'paragraph') {
        let content = toString(excludeObjectExpressions(node))
        if (node.type === 'heading' && node.depth <= 2) {
          let hash = node.depth === 1 ? null : slugify(content)
          sections.push([content, hash, []])
        } else {
          sections.at(-1)?.[2].push(content)
        }
        return SKIP
      }
    })
  }
}

async function generateSearchIndex() {
  console.log('Generating search index...')
  let appDir = path.resolve('./src/app')
  let files = glob.sync('**/*.mdx', { cwd: appDir })
  
  let data = files.map((file) => {
    let url = '/' + file.replace(/(^|\/)page\.mdx$/, '')
    let mdx = fs.readFileSync(path.join(appDir, file), 'utf8')

    let sections = []
    let vfile = { value: mdx, sections }
    processor.runSync(processor.parse(vfile), vfile)

    return { url, sections }
  })

  const outputPath = path.resolve('./src/mdx/search.json')
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
  console.log(`Search index written to ${outputPath}`)
}

generateSearchIndex()
