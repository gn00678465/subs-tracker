import {
  Archive,
  Check,
  createIcons,
  Edit3,
  Fingerprint,
  Info,
  Key,
  Laptop,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Smartphone,
  Sun,
  Ticket,
  Trash2,
  TriangleAlert,
} from 'lucide'

// 定義所有可用的 icons
const icons = {
  LogOut,
  List,
  Settings,
  Sun,
  Moon,
  SendHorizontal,
  Archive,
  Plus,
  Search,
  Menu,
  Check,
  Info,
  Ticket,
  TriangleAlert,
  Fingerprint,
  Edit3,
  Trash2,
  Key,
  Laptop,
  Smartphone,
}

// 配置選項
const iconConfig = {
  icons,
  attrs: {
    'stroke-width': 2,
    'class': 'lucide-icon',
  },
  nameAttr: 'data-lucide',
}

// 初始化圖示
createIcons(iconConfig)

// 暴露到全域，供動態 HTML 使用
;(window as any).lucide = {
  createIcons: () => createIcons(iconConfig),
}
