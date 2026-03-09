import { motion } from "framer-motion";
import { Bot, PenLine, Flame } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Conversational AI Tutors",
    description:
      "Each user gets a personal AI that converses naturally, corrects mistakes, explains grammar in simple terms, and gives speaking prompts tailored to your interests.",
    gradient: "gradient-primary",
  },
  {
    icon: PenLine,
    title: "Reading & Writing Mode",
    description:
      "Read short texts, stories, or dialogues in your target language, then respond or summarize. Write messages, essays, or journal entries and get instant corrections and feedback.",
    gradient: "gradient-accent",
  },
  {
    icon: Flame,
    title: "Progress, Badges & Streaks",
    description:
      "Earn badges for milestones like '7-Day Streak,' 'First 100 Conversations,' and 'Grammar Master.' Get daily streak notifications to stay on track.",
    gradient: "gradient-primary",
  },
];

const FeatureDeepDive = () => {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Built for real fluency
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Forget flashcards. Practice the way native speakers actually communicate.
          </p>
        </motion.div>

        <div className="space-y-8 max-w-3xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex gap-5 items-start rounded-2xl bg-card p-6 md:p-8 shadow-card"
            >
              <div className={`h-12 w-12 shrink-0 rounded-xl ${f.gradient} flex items-center justify-center`}>
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureDeepDive;
