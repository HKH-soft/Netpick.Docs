import { Providers } from '@/app/providers'
import { Layout } from '@/components/Layout'
import allSections from '@/mdx/allSections.json'

import '@/styles/tailwind.css'

export const metadata = {
  title: {
    template: '%s - WikiPick',
    default: 'WikiPick Documentation',
  },
}

export default async function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full bg-white antialiased dark:bg-zinc-900">
        <Providers>
          <div className="w-full">
            <Layout allSections={allSections}>{children}</Layout>
          </div>
        </Providers>
      </body>
    </html>
  )
}
