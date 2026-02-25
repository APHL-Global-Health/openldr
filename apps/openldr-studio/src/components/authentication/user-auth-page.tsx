import { Link } from "react-router-dom";
import { UserAuthForm } from "./user-auth-form";
import { Squares } from "@/components/squares-background";
import { HyperText } from "@/components/hyper-text";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";
import { LanguageSwitcher } from "@/components/language-switcher";

export function UserAuthPage() {
  const { t } = useMultiNamespaceTranslation(["common", "app"]);

  return (
    <div className="container min-h-[calc(100vh)] max-h-[calc(100vh)] relative w-full h-full flex-col justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full justify-center items-center flex-col bg-muted overflow-hidden p-10 border-r lg:flex">
        <div className="absolute w-full h-full  top-0 left-0  bg-white">
          <Squares
            direction="diagonal"
            speed={0.5}
            squareSize={40}
            borderColor="#333"
            hoverFillColor="#222"
          />
        </div>
        <HyperText
          className="relative z-20 flex text-4xl font-bold"
          text="OPENLDR"
        />
      </div>
      <div className="items-center flex h-full w-full max-w-lg mx-auto flex-col space-y-6 sm:px-8">
        <div className="lg:p-8 flex flex-1 mx-auto w-full flex-col justify-center space-y-6 sm:w-87.5">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("app:authentication.welcome")}
            </h1>
          </div>
          <UserAuthForm />
          <p className="px-8 text-center text-sm">
            {t("app:authentication.by_clicking_you_agree")}{" "}
            <Link
              to="/"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t("app:authentication.terms_and_policies")}{" "}
            </Link>{" "}
            {t("app:authentication.and")}{" "}
            <Link
              to="/"
              className="underline underline-offset-4 hover:text-primary"
            >
              {t("app:authentication.privacy_policy")}
            </Link>
            .
          </p>
        </div>
        <div className="flex min-h-13 max-h-13 w-full items-center justify-center px-2 py-2">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
