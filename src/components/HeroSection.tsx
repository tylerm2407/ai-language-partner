import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

const floatingElements = [
  { emoji: "🇪🇸", x: "10%", y: "20%", delay: 0, size: "text-4xl" },
  { emoji: "🇯🇵", x: "85%", y: "15%", delay: 0.5, size: "text-3xl" },
  { emoji: "🇫🇷", x: "75%", y: "70%", delay: 1, size: "text-4xl" },
  { emoji: "🇧🇷", x: "5%", y: "65%", delay: 1.5, size: "text-3xl" },
  { emoji: "🇩🇪", x: "90%", y: "45%", delay: 0.8, size: "text-2xl" },
  { emoji: "🇰🇷", x: "20%", y: "80%", delay: 1.2, size: "text-2xl" },
  { emoji: "💬", x: "50%", y: "10%", delay: 0.3, size: "text-3xl" },
  { emoji: "🌍", x: "65%", y: "85%", delay: 0.7, size: "text-3xl" },
];

const chatMessages = [
  { role: "user", text: "Hola, ¿cómo estás hoy?", lang: "es" },
  { role: "ai", text: "¡Hola! Estoy muy bien, gracias. ¿Y tú? 😊", lang: "es" },
  { role: "user", text: "Bien. Quiero practicar mi español.", lang: "es" },
  { role: "ai", text: '¡Perfecto! Tu español es muy bueno. Let me suggest: try using "quisiera" instead of "quiero" for a more polite tone.', lang: "es" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen gradient-hero pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Floating flag/emoji elements */}
      {floatingElements.map((el, i) => (
        <motion.div
          key={i}
          className={`absolute ${el.size} opacity-20 select-none pointer-events-none`}
          style={{ left: el.x, top: el.y }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            delay: el.delay,
            ease: "easeInOut",
          }}
        >
          {el.emoji}
        </motion.div>
      ))}

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[80vh]">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm font-medium text-primary mb-6"
            >
              <Sparkles className="h-4 w-4" />
              AI-Powered Language Learning
            </motion.div>

            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight mb-6 text-foreground">
              Become Fluent with{" "}
              <span className="text-gradient">Your Own AI</span>{" "}
              <span className="text-gradient-accent">Language Tutor</span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed mb-10 max-w-lg text-muted-foreground">
              Practice real conversations, reading, and writing in 50 of the world's most spoken languages—guided by a personal AI that adapts to you.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/login"><Button
                size="lg"
                className="gradient-primary border-0 text-primary-foreground font-semibold text-base px-8 shadow-glow hover:shadow-[0_0_80px_-12px_hsl(174_100%_50%/0.6)] transition-shadow duration-300"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button></Link>
              <Button
                size="lg"
                variant="outline"
                className="font-semibold text-base px-8 border-border text-foreground hover:bg-secondary hover:text-foreground glass"
              >
                Explore Languages
              </Button>
            </div>

            {/* Social proof strip */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["😊", "🧑‍💻", "👩‍🎓", "🧑‍🏫"].map((emoji, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-sm">
                    {emoji}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-semibold">50,000+</span> learners already practicing
              </p>
            </div>
          </motion.div>

          {/* Right - 3D Chat Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotateY: -10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex justify-center preserve-3d"
          >
            <div className="relative w-full max-w-sm">
              {/* Glow behind phone */}
              <div className="absolute inset-0 gradient-primary rounded-3xl blur-[60px] opacity-20 scale-90" />

              {/* Phone frame */}
              <div className="relative glass rounded-3xl p-1 shadow-card card-3d">
                <div className="bg-background/80 rounded-[20px] overflow-hidden">
                  {/* Phone header */}
                  <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      AI
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Spanish Tutor</p>
                      <p className="text-xs text-primary">● Online now</p>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="px-4 py-5 space-y-3 min-h-[320px]">
                    {chatMessages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.4 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "gradient-primary text-primary-foreground rounded-br-md"
                              : "glass text-foreground rounded-bl-md"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Input bar */}
                  <div className="px-4 py-3 border-t border-border">
                    <div className="rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                      Type a message...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
