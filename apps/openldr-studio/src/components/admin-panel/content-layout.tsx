import { Navbar } from "@/components/admin-panel/navbar";

interface ContentLayoutProps {
  nav: React.ReactNode;
  children: React.ReactNode;
}

export function ContentLayout({ nav, children }: ContentLayoutProps) {
  return (
    <div>
      <Navbar children={nav} />
      <div className="flex flex-1">{children}</div>
    </div>
  );
}
