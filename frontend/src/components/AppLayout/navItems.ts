import {
  IconChartHistogram,
  IconLayoutDashboard,
  IconNotebook,
  IconSettings,
  IconTrendingUp,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'

export interface NavItem {
  label: string
  path: string
  icon: Icon
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: IconLayoutDashboard },
  { label: 'Journal', path: '/journal', icon: IconNotebook },
  { label: 'Analytics', path: '/analytics', icon: IconChartHistogram },
  { label: 'Projections', path: '/projections', icon: IconTrendingUp },
  { label: 'Settings', path: '/settings', icon: IconSettings },
]
