import { AppShell, Box, NavLink } from '@mantine/core'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { mainNavItems, settingsNavItem } from './navItems'
import type { NavItem } from './navItems'
import { Logo } from '../Logo/Logo'
import { BackupReminderBanner } from '../BackupReminderBanner'
import classes from './AppLayout.module.css'

export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()

  const renderNavLink = (item: NavItem) => {
    const isActive =
      item.path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.path)
    return (
      <NavLink
        key={item.path}
        component={Link}
        to={item.path}
        label={t(item.labelKey)}
        leftSection={<item.icon size={20} stroke={1.5} />}
        active={isActive}
      />
    )
  }

  return (
    <AppShell
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: false, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Navbar p="sm">
        <Box px="xs" py="sm" mb="xs">
          <Logo />
        </Box>
        <AppShell.Section grow>{mainNavItems.map(renderNavLink)}</AppShell.Section>
        <AppShell.Section className={classes.bottomSection}>
          {renderNavLink(settingsNavItem)}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1400} mx="auto">
          <BackupReminderBanner />
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
