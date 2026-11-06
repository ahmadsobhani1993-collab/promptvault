import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const ARTICLE_SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4',
    'hr', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'table', 'tbody', 'td', 'th',
    'thead', 'tr', 'u', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
}

function toRawContent(content: string | string[] | null | undefined): string {
  return Array.isArray(content) ? content.join('\n\n') : content ?? ''
}

export function articleContentToHtml(content: string | string[] | null | undefined): string {
  const raw = toRawContent(content).trim()
  if (!raw) return ''

  const html = /<\/?(?:a|blockquote|br|h[1-6]|img|li|ol|p|pre|table|ul)\b/i.test(raw)
    ? raw
    : marked.parse(raw, { async: false })

  return sanitizeHtml(html, ARTICLE_SANITIZER_OPTIONS)
}

export function articleContentToEditorHtml(content: string | string[] | null | undefined): string {
  return articleContentToHtml(content)
}
