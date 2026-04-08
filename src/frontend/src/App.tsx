import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import CADCanvas from "./components/CADCanvas";
import Footer from "./components/Footer";
import Header from "./components/Header";

const _queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={_queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
            <CADCanvas />
          </main>
          <Footer />
          <Toaster />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
