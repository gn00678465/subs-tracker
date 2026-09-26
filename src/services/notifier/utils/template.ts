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
export function renderTemplate(template: string, variables: TemplateVariables): TemplateRenderResult {
  try {
    // 替換值用函式傳入：字串形式會把名稱裡的 $& 之類的文字當成替換樣式
    const rendered = template
      .replace(/\{\{title\}\}/g, () => escapeJsonString(variables.title))
      .replace(/\{\{content\}\}/g, () => escapeJsonString(variables.content))
      .replace(/\{\{timestamp\}\}/g, () => escapeJsonString(variables.timestamp))

    // 驗證 JSON 格式
    try {
      JSON.parse(rendered)
    } catch (jsonError) {
      return {
        success: false,
        error: `渲染後的 JSON 無效: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`,
      }
    }

    return {
      success: true,
      rendered,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// 模板的變數寫在 JSON 字串的引號內，所以只取 JSON.stringify 結果中引號內的部分
function escapeJsonString(str: string): string {
  return JSON.stringify(str).slice(1, -1)
}
