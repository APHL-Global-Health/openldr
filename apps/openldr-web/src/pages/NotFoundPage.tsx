function NotFoundPage() {
  const statusCode = 404;
  const title = "Page not found";
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
          <p className="mb-5 font-bold tracking-tight text-primary">
            {statusCode} error
          </p>
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
