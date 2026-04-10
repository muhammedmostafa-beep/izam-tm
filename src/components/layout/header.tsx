"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  LayoutGrid,
  Table2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewMode, setViewMode] = useState<"dashboard" | "grid">("dashboard");

  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-6 bg-header-bg border-b border-header-border backdrop-blur-sm">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search stories, test cases, bugs..."
            className="input pl-9 h-9 text-sm bg-muted border-transparent focus:bg-background-secondary focus:border-input-border"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 mr-2">
          <button
            onClick={() => setViewMode("dashboard")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150",
              viewMode === "dashboard"
                ? "bg-background-secondary shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Dashboard view"
            title="Dashboard View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150",
              viewMode === "grid"
                ? "bg-background-secondary shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Grid view"
            title="Grid View"
          >
            <Table2 size={15} />
          </button>
        </div>

        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {/* Notification dot */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full pulse-dot" />
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 z-50 glass-card shadow-lg overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Notifications
                  </h3>
                </div>
                <div className="p-8 text-center">
                  <Bell
                    size={24}
                    className="mx-auto mb-2 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    No new notifications
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="relative w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User"}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-primary">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="hidden md:flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                {user?.name || "User"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {user?.role || "Loading..."}
              </span>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 z-50 glass-card shadow-lg overflow-hidden animate-fade-in">
                {/* User Info */}
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1.5 badge badge-primary">
                    {user?.role}
                  </span>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <User size={15} className="text-muted-foreground" />
                    Profile
                  </button>
                  <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Settings size={15} className="text-muted-foreground" />
                    Settings
                  </button>
                </div>

                {/* Sign Out */}
                <div className="border-t border-border py-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
