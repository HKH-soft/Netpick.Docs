import { slugifyWithCounter } from '@sindresorhus/slugify'
import glob from 'fast-glob'
import * as fs from 'fs'
import { toString } from 'mdast-util-to-string'
import * as path from 'path'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { filter } from 'unist-util-filter'
import { SKIP, visit } from 'unist-util-visit'
import * as acorn from 'acorn'

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

// Extract sections export from MDX file content using acorn parser
function extractSectionsExport(mdxContent) {
  const sectionsMatch = mdxContent.match(/export const sections = (\[[\s\S]*?\n\])/);
  if (sectionsMatch) {
    try {
      // Parse as JavaScript expression using acorn
      const parsed = acorn.parseExpressionAt(sectionsMatch[1], 0, { ecmaVersion: 2020 });
      
      // Convert AST to plain JavaScript object
      function astToValue(node) {
        if (node.type === 'ArrayExpression') {
          return node.elements.map(el => astToValue(el));
        } else if (node.type === 'ObjectExpression') {
          const obj = {};
          node.properties.forEach(prop => {
            const key = prop.key.name || prop.key.value;
            obj[key] = astToValue(prop.value);
          });
          return obj;
        } else if (node.type === 'Literal') {
          return node.value;
        }
        return null;
      }
      
      return astToValue(parsed);
    } catch (e) {
      console.warn('Failed to parse sections export:', e);
      return [];
    }
  }
  return [];
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

async function generateAllSections() {
  console.log('Generating allSections data...')
  let appDir = path.resolve('./src/app')
  let files = glob.sync('**/*.mdx', { cwd: appDir })
  
  let allSections = {}
  
  files.forEach((file) => {
    let url = '/' + file.replace(/(^|\/)page\.mdx$/, '')
    let mdx = fs.readFileSync(path.join(appDir, file), 'utf8')
    let sections = extractSectionsExport(mdx)
    allSections[url] = sections
  })

  const outputPath = path.resolve('./src/mdx/allSections.json')
  fs.writeFileSync(outputPath, JSON.stringify(allSections, null, 2))
  console.log(`All sections data written to ${outputPath}`)
}

generateSearchIndex()
generateAllSections()
