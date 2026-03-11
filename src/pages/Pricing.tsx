import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

const Pricing = () => {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <div className="pt-16">
        <PricingSection />
        <FAQSection />
      </div>
      <Footer />
    </div>
  );
};

export default Pricing;
