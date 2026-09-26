import type { IconNode } from 'lucide'

export const Icon = ({ node, class: className }: { node: IconNode; class?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
    aria-hidden="true"
  >
    {node.map(([Tag, attrs]) => (
      <Tag {...attrs} />
    ))}
  </svg>
)
