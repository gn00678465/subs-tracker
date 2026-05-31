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

export function renderIcons(root?: Element | Document | DocumentFragment): void {
  createIcons({
    icons,
    attrs: {
      'stroke-width': 2,
      'class': 'lucide-icon',
    },
    nameAttr: 'data-lucide',
    ...(root ? { root: root as Element | Document | DocumentFragment } : {}),
  })
}
