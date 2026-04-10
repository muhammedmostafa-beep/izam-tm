"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  TestTube2,
  Bug,
  Layers,
  BarChart3,
  Settings,
  Users,
  Link2,
  Brain,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Upload,
  History,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Traceability Matrix", href: "/matrix", icon: Layers },
      { label: "Coverage Summary", href: "/matrix/coverage", icon: BarChart3 },
    ],
  },
  {
    title: "Traceability",
    items: [
      { label: "Epics", href: "/epics", icon: FileText },
      { label: "User Stories", href: "/stories", icon: ListChecks },
      { label: "Test Cases", href: "/test-cases", icon: TestTube2 },
      { label: "Bugs", href: "/bugs", icon: Bug },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "AI Analysis", href: "/ai-analysis", icon: Brain },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Roles", href: "/admin/roles", icon: Shield },
      { label: "Approvals", href: "/admin/approvals", icon: Shield },
      { label: "Lookups", href: "/admin/lookups", icon: Settings },
      { label: "Field Config", href: "/admin/fields", icon: Settings },
      { label: "Jira Integration", href: "/admin/jira", icon: Link2 },
      { label: "Import / Export", href: "/admin/import-export", icon: Upload },
      { label: "Activity Log", href: "/admin/activity", icon: History },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-40 h-screen flex flex-col bg-sidebar-bg border-r border-sidebar-border sidebar-transition",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo Area */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="relative w-9 h-9 shrink-0">
            <Image
              src="/izam.webp"
              alt="izam"
              fill
              className="object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground tracking-tight truncate">
                izam TM
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">
                Traceability Matrix
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navigation.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-item-active text-sidebar-text-active"
                          : "text-sidebar-text hover:bg-sidebar-item-hover hover:text-foreground"
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          "shrink-0",
                          isActive && "text-sidebar-text-active"
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto badge badge-primary text-[10px]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center w-full py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-item-hover hover:text-foreground transition-colors",
            collapsed && "px-0"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
