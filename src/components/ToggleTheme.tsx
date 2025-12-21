interface ThemeToggleProps {
  class?: string
}

function ThemeToggle({ class: className }: ThemeToggleProps) {
  return (
    <div class={className}>
      <label class="swap swap-rotate cursor-pointer">
        <input type="checkbox" class="theme-controller" id="theme-toggle" />

        {/* 太陽圖示 (light mode) */}
        <i data-lucide="sun" class="swap-off size-8"></i>

        {/* 月亮圖示 (dark mode) */}
        <i data-lucide="moon" class="swap-on size-8"></i>
      </label>
    </div>
  )
}

export default ThemeToggle
