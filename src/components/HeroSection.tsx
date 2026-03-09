import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroPhone from "@/assets/hero-phone.png";

const HeroSection = () => {
  return (
    <section className="gradient-hero pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Language Learning
            </div>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              Become Fluent with Your Own{" "}
              <span className="text-gradient">AI Language Tutor</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Practice real conversations with advanced personal AIs in 50 of the world's most spoken languages.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="gradient-primary border-0 text-primary-foreground font-semibold text-base px-8 shadow-glow">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="font-semibold text-base px-8">
                Explore Languages
              </Button>
            </div>
          </motion.div>

          {/* Right image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="animate-float">
              <img
                src={heroPhone}
                alt="Fluenci app showing an AI language tutoring conversation"
                className="w-full max-w-sm md:max-w-md drop-shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
