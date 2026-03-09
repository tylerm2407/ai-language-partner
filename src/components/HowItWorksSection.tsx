import { motion } from "framer-motion";
import { Languages, MessageCircle, Award, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Languages,
    step: "01",
    title: "Choose Your Language",
    description: "Pick from 50 of the world's most spoken languages. Set your proficiency level and goals.",
    color: "from-primary to-primary/60",
  },
  {
    icon: MessageCircle,
    step: "02",
    title: "Meet Your AI Tutor",
    description: "Start real-time conversation practice. Your AI adapts to your level and corrects mistakes naturally.",
    color: "from-[hsl(220,90%,60%)] to-[hsl(220,90%,40%)]",
  },
  {
    icon: Award,
    step: "03",
    title: "Read, Write & Earn Badges",
    description: "Complete reading and writing exercises, get instant feedback, and build daily streaks.",
    color: "from-accent to-accent/60",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-section" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">How It Works</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Three steps to fluency
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            No textbooks. No flashcards. Just real practice with AI.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative group"
            >
              <div className="glass rounded-2xl p-8 h-full card-3d relative overflow-hidden">
                {/* Subtle top gradient line */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color} opacity-60`} />

                <div className="relative mb-6">
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                    <s.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <span className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-secondary text-foreground text-xs font-bold flex items-center justify-center border border-border">
                    {s.step}
                  </span>
                </div>

                <h3 className="font-heading text-xl font-semibold mb-3 text-foreground">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>

              {/* Connector arrow (not on last) */}
              {i < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <ArrowRight className="h-5 w-5 text-border" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
