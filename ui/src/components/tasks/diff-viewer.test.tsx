import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>, useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/tasks' }) }
})

import { DiffViewer } from './diff-viewer'

const sampleDiff = `diff --git a/file.go b/file.go
--- a/file.go
+++ b/file.go
@@ -1,3 +1,4 @@
 package main
-import "fmt"
+import "log"
+import "os"
 func main() {}`

describe('DiffViewer', () => {
  it('renders a unified diff with correct line styles', () => {
    render(<DiffViewer diff={sampleDiff} />)
    const viewer = screen.getByTestId('diff-viewer')
    expect(viewer).toBeInTheDocument()
    // Check that addition lines have green background
    const additionLines = viewer.querySelectorAll('.bg-status-succeeded-bg')
    expect(additionLines.length).toBe(2)
    // Check that deletion lines have red background
    const deletionLines = viewer.querySelectorAll('.bg-status-failed-bg')
    expect(deletionLines.length).toBe(1)
  })

  it('renders file headers', () => {
    render(<DiffViewer diff={sampleDiff} />)
    expect(screen.getByText('--- a/file.go')).toBeInTheDocument()
    expect(screen.getByText('+++ b/file.go')).toBeInTheDocument()
  })

  it('renders hunk headers with blue styling', () => {
    render(<DiffViewer diff={sampleDiff} />)
    const viewer = screen.getByTestId('diff-viewer')
    const hunkHeaders = viewer.querySelectorAll('.bg-status-running-bg')
    expect(hunkHeaders.length).toBe(1)
  })

  it('renders empty diff message', () => {
    render(<DiffViewer diff="" />)
    expect(screen.getByText('No diff available')).toBeInTheDocument()
  })

  it('numbers only real source lines and keeps metadata unnumbered', () => {
    const patch = `diff --git a/note.txt b/note.txt
index 489ce0f..3e5126c 100644
--- a/note.txt
+++ b/note.txt
@@ -1 +1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file
`
    render(<DiffViewer diff={patch} />)
    const rows = Array.from(screen.getByTestId('diff-viewer').querySelectorAll('div.flex'))

    const cells = (row: Element) => {
      const spans = row.querySelectorAll('span')
      return { old: spans[0]?.textContent ?? '', new: spans[1]?.textContent ?? '', content: spans[2]?.textContent ?? '' }
    }

    expect(rows).toHaveLength(9)
    const byContent = Object.fromEntries(rows.map((row) => [cells(row).content, cells(row)]))

    // The removed and added lines both belong to line 1 of their files.
    expect(byContent['-old']).toMatchObject({ old: '1', new: '' })
    expect(byContent['+new']).toMatchObject({ old: '', new: '1' })
    // Metadata keeps no numbers and never advances the counters.
    expect(byContent['index 489ce0f..3e5126c 100644']).toMatchObject({ old: '', new: '' })
    expect(byContent['\\ No newline at end of file']).toMatchObject({ old: '', new: '' })
  })

  it('starts later hunks at their declared positions and preserves blank context lines', () => {
    const patch = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -5,3 +5,3 @@
 five
 six
-seven
+seven
@@ -12,3 +12,3 @@
 twelve
 
 thirteen
\\ No newline at end of file
`
    render(<DiffViewer diff={patch} />)
    const rows = Array.from(screen.getByTestId('diff-viewer').querySelectorAll('div.flex'))
    const cells = (row: Element) => {
      const spans = row.querySelectorAll('span')
      return { old: spans[0]?.textContent ?? '', new: spans[1]?.textContent ?? '', content: spans[2]?.textContent ?? '' }
    }
    const byContent = Object.fromEntries(rows.map((row) => [cells(row).content, cells(row)]))

    expect(byContent[' twelve']).toMatchObject({ old: '12', new: '12' })
    // A blank context line carries a leading space and still counts.
    expect(byContent[' ']).toMatchObject({ old: '13', new: '13' })
    expect(byContent[' thirteen']).toMatchObject({ old: '14', new: '14' })
    expect(byContent['\\ No newline at end of file']).toMatchObject({ old: '', new: '' })
  })
})
