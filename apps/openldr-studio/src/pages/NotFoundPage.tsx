import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoImage from "@/assets/OpenODRv2Logo.png";

function NotFoundPage() {
  const statusCode = 404;
  const title = "Page not found";

  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1); // Goes back one page in history
  };

  return (
    <div className="flex w-full h-full items-center justify-center">
      <div className="relative flex w-full h-screen items-center">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right,rgba(214, 251, 252, 0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(214, 251, 252, 0.06) 1px,transparent 1px)",
            maskImage:
              "radial-gradient(ellipse 50% 70% at 50% 0%,#000 70%,transparent 110%)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="container relative z-1 flex flex-col items-center justify-center text-center">
          <div className="flex flex-row mb-5">
            <div className="w-5.5 overflow-hidden">
              <img
                src={logoImage}
                alt="openldr"
                className="h-6 object-cover object-left logo"
              />
            </div>
            <div className="ml-2 mt-0.5">OpenLDR</div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            {title}
          </h1>
          <Button variant="outline" className="mt-8" onClick={handleBack}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
