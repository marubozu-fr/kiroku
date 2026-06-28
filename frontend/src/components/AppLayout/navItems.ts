import {
  IconCategory2,
  IconChartHistogram,
  IconLayoutDashboard,
  IconNotebook,
  IconSettings,
  IconTrendingUp,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'

export interface NavItem {
  labelKey: string
  path: string
  icon: Icon
}

// Main nav items (grow section)
export const mainNavItems: NavItem[] = [
  { labelKey: 'nav.dashboard', path: '/', icon: IconLayoutDashboard },
  { labelKey: 'nav.journal', path: '/journal', icon: IconNotebook },
  { labelKey: 'nav.analytics', path: '/analytics', icon: IconChartHistogram },
  { labelKey: 'nav.projections', path: '/projections', icon: IconTrendingUp },
  { labelKey: 'nav.manage', path: '/manage', icon: IconCategory2 },
]

// Bottom-pinned
export const settingsNavItem: NavItem = {
  labelKey: 'nav.settings',
  path: '/settings',
  icon: IconSettings,
}
