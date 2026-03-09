import { motion } from "framer-motion";
import { MessageSquare, Globe2, BookOpen, Trophy } from "lucide-react";

const benefits = [
  {
    icon: MessageSquare,
    title: "AI Conversation Partner",
    description: "Talk to a personal AI that acts like a private language teacher and adapts to your level.",
  },
  {
    icon: Globe2,
    title: "50 Popular Languages",
    description: "Learn and practice any of the 50 most commonly spoken languages in the world.",
  },
  {
    icon: BookOpen,
    title: "Speak, Read & Write",
    description: "Dedicated modes for conversation, reading practice, and writing practice.",
  },
  {
    icon: Trophy,
    title: "Daily Streaks & Badges",
    description: "Stay motivated with achievement badges, daily usage streaks, and progress tracking.",
  },
];

const BenefitsSection = () => {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Everything you need to become fluent
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Our AI tutors combine conversation practice, reading, and writing exercises to build real-world fluency.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-2xl bg-card p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300"
            >
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-5">
                <b.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2 text-card-foreground">{b.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{b.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
