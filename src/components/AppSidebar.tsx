import { Home, FileText, BarChart3, Plus, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoIcon from "@/assets/logo-icon.png";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Novo Documento", url: "/add", icon: Plus },
];

export function AppSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="glass border-r border-border/50">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-border/50">
          <img src={logoIcon} alt="Sollytchain" className="w-8 h-8" />
          {open && (
            <div>
              <h2 className="font-bold text-foreground">Sollytchain</h2>
              <p className="text-xs text-muted-foreground">Docs</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={open ? "" : "sr-only"}>
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Blockchain Status */}
        {open && (
          <div className="mt-auto p-4 border-t border-border/50">
            <div className="glass p-3 rounded-lg border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-success" />
                <span className="text-xs font-medium text-foreground">
                  Blockchain Ativo
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Rede segura e operacional
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
