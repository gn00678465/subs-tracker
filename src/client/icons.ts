import {
  Archive,
  Check,
  createIcons,
  Info,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sun,
  Ticket,
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
    Menu,
    Check,
    Info,
    Ticket,
  },
  attrs: {
    'stroke-width': 2,
    'class': 'lucide-icon',
  },
  nameAttr: 'data-lucide',
  inTemplates: true,
})
