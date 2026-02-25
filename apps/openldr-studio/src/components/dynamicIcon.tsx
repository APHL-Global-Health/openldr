import * as LucideIcons from "lucide-react";

// Type for the icon component
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// Function to get icon component from string
const getLucideIcon = (iconName: string): IconComponent | null => {
  // Convert kebab-case or snake_case to PascalCase
  const pascalCase = iconName
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  return (
    (LucideIcons as unknown as Record<string, IconComponent>)[pascalCase] ||
    null
  );
};

// Usage example
export const DynamicIcon = ({
  iconName,
  size = 16,
  className,
}: {
  iconName: string;
  size?: number;
  className: string;
}) => {
  const Icon = getLucideIcon(iconName);

  if (!Icon) {
    return <LucideIcons.HelpCircle size={size} className={className} />; // Fallback icon
  }

  return <Icon size={size} className={className} />;
};
