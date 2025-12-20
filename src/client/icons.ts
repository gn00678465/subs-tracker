import {
  Archive,
  createIcons,
  List,
  LogOut,
  Moon,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sun,
} from 'lucide'

// 初始化圖示
createIcons({
  icons: {
    LogOut,
    List,
    Settings,
    Sun,
    Moon,
    SendHorizontal,
    Archive,
    Plus,
    Search,
  },
  attrs: {
    'stroke-width': 2,
    'class': 'lucide-icon',
  },
  nameAttr: 'data-lucide',
  inTemplates: true,
})
