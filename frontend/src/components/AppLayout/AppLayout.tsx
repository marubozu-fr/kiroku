import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Group,
  NavLink,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { navItems } from './navItems'
import { Logo } from '../Logo/Logo'

export function AppLayout() {
  const { t } = useTranslation()
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const location = useLocation()

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
            <Logo />
          </Group>
          <ActionIcon
            variant="default"
            size="lg"
            onClick={toggleColorScheme}
            aria-label={t('app.toggle_color_scheme')}
          >
            {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {navItems.map((item) => {
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
              onClick={mobileOpened ? toggleMobile : undefined}
            />
          )
        })}
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1400} mx="auto">
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
