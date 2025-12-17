interface HtmxBeforeRequestDetail {
  elt: Element
  xhr: XMLHttpRequest
  target: Element
  requestConfig: {
    boosted: boolean
    useUrlParams: boolean
    formData: FormData
    parameters: Record<string, any>
    unfilteredParameters: Record<string, any>
    headers: Record<string, string>
    verb: string
    errors: any[]
    withCredentials: boolean
    timeout: number
    path: string
    triggeringEvent: Event
  }
}

// CustomEvent 的泛型型別
interface HtmxBeforeRequestEvent extends CustomEvent<HtmxBeforeRequestDetail> {
  type: 'htmx:beforeRequest'
}
