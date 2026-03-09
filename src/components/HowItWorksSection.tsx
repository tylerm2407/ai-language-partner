import { motion } from "framer-motion";
import { Languages, MessageCircle, Award } from "lucide-react";

const steps = [
  {
    icon: Languages,
    step: "01",
    title: "Choose Your Language",
    description: "Select your target language and your native language from 50 options.",
  },
  {
    icon: MessageCircle,
    step: "02",
    title: "Chat with Your AI Tutor",
    description: "Start talking via text or voice chat. Your AI adapts to your skill level.",
  },
  {
    icon: Award,
    step: "03",
    title: "Practice & Earn Badges",
    description: "Complete reading and writing exercises, earn badges, and maintain your daily streak.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Get started in three simple steps
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="relative mx-auto mb-6">
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
                  <s.icon className="h-8 w-8 text-primary-foreground" />
                </div>
                <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                  {s.step}
                </span>
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2 text-foreground">{s.title}</h3>
              <p className="text-sm leading-relaxed max-w-xs mx-auto text-muted-foreground">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
