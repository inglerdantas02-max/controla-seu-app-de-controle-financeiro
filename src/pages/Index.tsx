import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Benefits } from "@/components/landing/Benefits";
import { Plans } from "@/components/landing/Plans";
import { Footer } from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      <Hero />
      <Benefits />
      <Plans />
    </main>
    <Footer />
  </div>
);

export default Index;
