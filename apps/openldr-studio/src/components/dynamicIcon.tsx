import {
  // Navigation & layout
  LayoutGrid,
  Settings,
  Home,
  Menu,
  Sidebar,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  // Data & database
  Database,
  Table2,
  FileText,
  File,
  Folder,
  FolderOpen,
  Archive,
  SquareLibrary,
  // Actions
  Upload,
  Download,
  Save,
  Trash2,
  Edit,
  Plus,
  PlusCircle,
  X,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  // Status & feedback
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  Loader2,
  // Communication
  MessageCircle,
  Bell,
  Mail,
  // People & org
  User,
  Users,
  Building2,
  // Tech & system
  Terminal,
  Command,
  Bot,
  Cpu,
  Server,
  Unplug,
  Box,
  Package,
  Layers,
  Zap,
  // Health & science
  Activity,
  Microscope,
  // Misc
  BookText,
  Map,
  MapPin,
  BarChart3,
  Hash,
  Shield,
  ShieldAlert,
  Star,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  layoutgrid: LayoutGrid,
  settings: Settings,
  home: Home,
  menu: Menu,
  sidebar: Sidebar,
  panelleft: PanelLeft,
  chevrondown: ChevronDown,
  chevronright: ChevronRight,
  chevronleft: ChevronLeft,
  chevronup: ChevronUp,
  arrowright: ArrowRight,
  arrowleft: ArrowLeft,
  database: Database,
  table2: Table2,
  filetext: FileText,
  file: File,
  folder: Folder,
  folderopen: FolderOpen,
  archive: Archive,
  squarelibrary: SquareLibrary,
  upload: Upload,
  download: Download,
  save: Save,
  trash2: Trash2,
  edit: Edit,
  plus: Plus,
  pluscircle: PlusCircle,
  x: X,
  search: Search,
  filter: Filter,
  refreshcw: RefreshCw,
  copy: Copy,
  eye: Eye,
  eyeoff: EyeOff,
  check: Check,
  alerttriangle: AlertTriangle,
  alertcircle: AlertCircle,
  info: Info,
  helpcircle: HelpCircle,
  loader2: Loader2,
  messagecircle: MessageCircle,
  bell: Bell,
  mail: Mail,
  user: User,
  users: Users,
  building2: Building2,
  terminal: Terminal,
  command: Command,
  bot: Bot,
  cpu: Cpu,
  server: Server,
  unplug: Unplug,
  box: Box,
  package: Package,
  layers: Layers,
  zap: Zap,
  activity: Activity,
  microscope: Microscope,
  booktext: BookText,
  map: Map,
  mappin: MapPin,
  barchart3: BarChart3,
  hash: Hash,
  shield: Shield,
  shieldalert: ShieldAlert,
  star: Star,
};

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const getLucideIcon = (iconName: string): IconComponent | null => {
  const key = iconName
    .split(/[-_]/)
    .map((word) => word.toLowerCase())
    .join("");

  return (iconMap[key] as IconComponent) ?? null;
};

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
    return <HelpCircle size={size} className={className} />;
  }

  return <Icon size={size} className={className} />;
};
