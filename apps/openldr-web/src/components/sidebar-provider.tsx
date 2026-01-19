import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

type SideBarContextType = {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
};

const SideBarContext = createContext<SideBarContextType | undefined>(undefined);

export type SideBarProviderProps = {
  children?: React.ReactNode;
  value: {
    isCollapsed: boolean;
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  };
};

export function SideBarProvider({ children }: SideBarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SideBarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SideBarContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSideBarContext() {
  return useContext(SideBarContext);
}
