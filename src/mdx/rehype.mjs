import { slugifyWithCounter } from '@sindresorhus/slugify'
import * as acorn from 'acorn'
import { toString } from 'mdast-util-to-string'
import { mdxAnnotations } from 'mdx-annotations'
import { createHighlighter, createCssVariablesTheme, bundledLanguages } from 'shiki'
import { visit } from 'unist-util-visit'

function rehypeParseCodeBlocks() {
  return (tree) => {
    visit(tree, 'element', (node, _nodeIndex, parentNode) => {
      if (node.tagName === 'code') {
        parentNode.properties.language = node.properties.className
          ? node.properties?.className[0]?.replace(/^language-/, '')
          : 'txt'
      }
    })
  }
}

let highlighter

function rehypeShiki() {
  return async (tree) => {
    if (!highlighter) {
      const theme = createCssVariablesTheme({ name: 'css-variables', variablePrefix: '--shiki-' })
      highlighter = await createHighlighter({
        themes: [theme],
        langs: Object.values(bundledLanguages)
      })
    }

    let nodesToProcess = []

    visit(tree, 'element', (node) => {
      if (node.tagName === 'pre' && node.children[0]?.tagName === 'code') {
        let codeNode = node.children[0]
        let textNode = codeNode.children[0]

        node.properties.code = textNode.value

        if (node.properties.language) {
          nodesToProcess.push({ node, textNode })
        }
      }
    })

    for (let { node, textNode } of nodesToProcess) {
      let tokens = await highlighter.codeToTokens(
        textNode.value,
        { lang: node.properties.language, theme: 'css-variables' }
      )

      textNode.value = renderToHtml(tokens.tokens, {
        elements: {
          pre: ({ children }) => children,
          code: ({ children }) => children,
          line: ({ children }) => `<span>${children}</span>`,
        },
      })
    }
  }
}

function renderToHtml(lines, options) {
  let html = ''
  for (const line of lines) {
    let lineHtml = ''
    for (const token of line) {
      const style = `color: ${token.color}`
      lineHtml += `<span style="${style}">${token.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')}</span>`
    }
    if (options.elements?.line) {
      html += options.elements.line({ children: lineHtml })
    } else {
      html += lineHtml + '\n'
    }
  }
  return html
}

function rehypeSlugify() {
  return (tree) => {
    let slugify = slugifyWithCounter()
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h2' && !node.properties.id) {
        node.properties.id = slugify(toString(node))
      }
    })
  }
}

function rehypeAddMDXExports(getExports) {
  return (tree) => {
    let exports = Object.entries(getExports(tree))

    for (let [name, value] of exports) {
      for (let node of tree.children) {
        if (
          node.type === 'mdxjsEsm' &&
          new RegExp(`export\\s+const\\s+${name}\\s*=`).test(node.value)
        ) {
          return
        }
      }

      let exportStr = `export const ${name} = ${value}`

      tree.children.push({
        type: 'mdxjsEsm',
        value: exportStr,
        data: {
          estree: acorn.parse(exportStr, {
            sourceType: 'module',
            ecmaVersion: 'latest',
          }),
        },
      })
    }
  }
}

function getSections(node) {
  let sections = []

  for (let child of node.children ?? []) {
    if (child.type === 'element' && child.tagName === 'h2') {
      sections.push(`{
        title: ${JSON.stringify(toString(child))},
        id: ${JSON.stringify(child.properties.id)},
        ...${child.properties.annotation}
      }`)
    } else if (child.children) {
      sections.push(...getSections(child))
    }
  }

  return sections
}

export const rehypePlugins = [
  mdxAnnotations.rehype,
  rehypeParseCodeBlocks,
  rehypeShiki,
  rehypeSlugify,
  [
    rehypeAddMDXExports,
    (tree) => ({
      sections: `[${getSections(tree).join()}]`,
    }),
  ],
]
