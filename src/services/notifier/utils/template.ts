/**
 * Webhook 模板引擎
 * 支援變數: {{title}}, {{content}}, {{timestamp}}
 */

export interface TemplateVariables {
  title: string
  content: string
  timestamp: string
}

export interface TemplateRenderResult {
  success: boolean
  rendered?: string
  error?: string
}

/**
 * 渲染模板
 * @param template JSON 字串模板
 * @param variables 變數對象
 * @returns 渲染結果
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
): TemplateRenderResult {
  try {
    // 替換所有變數
    const rendered = template
      .replace(/\{\{title\}\}/g, escapeJsonString(variables.title))
      .replace(/\{\{content\}\}/g, escapeJsonString(variables.content))
      .replace(/\{\{timestamp\}\}/g, escapeJsonString(variables.timestamp))

    // 驗證 JSON 格式
    try {
      JSON.parse(rendered)
    }
    catch (jsonError) {
      return {
        success: false,
        error: `渲染後的 JSON 無效: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`,
      }
    }

    return {
      success: true,
      rendered,
    }
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 轉義 JSON 字串中的特殊字符
 * 避免破壞 JSON 結構
 */
function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // 反斜線
    .replace(/"/g, '\\"') // 雙引號
    .replace(/\n/g, '\\n') // 換行
    .replace(/\r/g, '\\r') // 回車
    .replace(/\t/g, '\\t') // Tab
    .replace(/\f/g, '\\f') // Form feed
    .replace(/\b/g, '\\b') // Backspace
}

/**
 * 驗證模板格式（可選）
 */
export function validateTemplate(template: string): { valid: boolean, error?: string } {
  try {
    // 檢查是否為有效 JSON
    JSON.parse(template)
    return { valid: true }
  }
  catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON template',
    }
  }
}
