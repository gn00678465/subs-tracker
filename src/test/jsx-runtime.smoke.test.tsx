/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'

describe('vitest + hono/jsx/dom runtime', () => {
  it('renders a component into a happy-dom node', () => {
    function Hello() {
      return <div id="hello">hi</div>
    }
    const root = document.createElement('div')
    render(<Hello />, root)
    expect(root.querySelector('#hello')?.textContent).toBe('hi')
  })
})
