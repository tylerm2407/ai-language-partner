import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import FeatureDeepDive from "@/components/FeatureDeepDive";
import LanguagesSection from "@/components/LanguagesSection";
import BadgesSection from "@/components/BadgesSection";
import StorySection from "@/components/StorySection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <FeatureDeepDive />
      <LanguagesSection />
      <BadgesSection />
      <StorySection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <Footer />
    </div>
  );
};

export default Index;
