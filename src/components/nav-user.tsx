"use client"

import { useEffect, useState } from "react"
import { useKBar } from "kbar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  IconCommand,
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeMenuContent } from "@/components/theme-menu-content"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { toast } from "sonner"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
}) {
  const { query } = useKBar()
  const { isMobile } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()
  const isAccountActive = pathname === "/account"
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleLogout = async () => {
    try {
      const { authClient } = await import("@/lib/auth-client")
      await authClient.signOut()
      toast.success("Logged out successfully")
      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Failed to logout")
    }
  }

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    user.email
      .slice(0, 2)
      .toUpperCase() ||
    "?"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Search (⌘K)"
          onClick={() => query.toggle()}
        >
          <IconCommand className="size-4 shrink-0" />
          <span>Search</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild isActive={isAccountActive} tooltip="Account">
          <Link href="/account" className="cursor-pointer">
            <IconUserCircle className="size-4 shrink-0" />
            <span>Account</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              type="button"
              aria-label="Account menu — theme and sign out"
              className="min-h-12 min-w-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar
                  className={`h-8 w-8 shrink-0 rounded-lg ${!mounted ? "grayscale" : ""}`}
                >
                  {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {/* Defer email until mount so SSR + hydration match (extensions / DOM quirks around @). */}
                    {mounted ? user.email : '\u00A0'}
                  </span>
                </div>
              </div>
              <div
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground pointer-events-none"
                aria-hidden
              >
                <IconDotsVertical className="size-[18px]" stroke={2} />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem asChild className="p-0">
              <Link
                href="/account"
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                aria-label={`Account — ${user.name}`}
              >
                <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                  {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {mounted ? user.email : '\u00A0'}
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ThemeMenuContent />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
