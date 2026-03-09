import { motion } from "framer-motion";
import { MessageSquare, BookOpen, PenTool, Brain } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "AI Conversation Partner",
    description: "Hold natural conversations in your target language. Your AI corrects grammar, suggests better phrases, and explains why — like a patient native speaker.",
    mockup: (
      <div className="space-y-2 p-4">
        <div className="flex justify-end">
          <div className="rounded-xl gradient-primary px-3 py-2 text-xs text-primary-foreground max-w-[70%]">
            Je voudrais aller au restaurant ce soir
          </div>
        </div>
        <div className="flex justify-start">
          <div className="rounded-xl glass px-3 py-2 text-xs text-foreground max-w-[70%]">
            Très bien ! 🎉 Perfect use of "voudrais." Try adding "avec mes amis" to extend the sentence.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: BookOpen,
    title: "Reading Practice",
    description: "Read short stories, articles, and dialogues in your target language. Tap any word for instant translation and context explanations.",
    mockup: (
      <div className="p-4 space-y-2">
        <p className="text-xs text-foreground leading-relaxed">
          El gato se sentó en la{" "}
          <span className="bg-primary/20 text-primary px-1 rounded cursor-pointer">ventana</span>{" "}
          y miró la{" "}
          <span className="bg-accent/20 text-accent px-1 rounded cursor-pointer">lluvia</span>{" "}
          caer suavemente.
        </p>
        <div className="glass rounded-lg p-2 text-[10px]">
          <p className="text-primary font-semibold">ventana</p>
          <p className="text-muted-foreground">= window (noun, feminine)</p>
        </div>
      </div>
    ),
  },
  {
    icon: PenTool,
    title: "Writing Feedback",
    description: "Write paragraphs, essays, or journal entries in your target language and receive instant AI annotations, corrections, and style suggestions.",
    mockup: (
      <div className="p-4 space-y-2">
        <div className="text-xs text-foreground border-b border-border pb-2">
          <span>Ich </span>
          <span className="line-through text-destructive/60">habe gehen</span>
          <span className="text-primary font-semibold"> bin gegangen</span>
          <span> zum Markt gestern.</span>
        </div>
        <div className="glass rounded-lg p-2 text-[10px] text-muted-foreground">
          💡 Use "bin gegangen" (Perfekt with sein) for movement verbs like "gehen."
        </div>
      </div>
    ),
  },
  {
    icon: Brain,
    title: "Your Private Language Teacher",
    description: "Your AI remembers your level, goals, and common mistakes. It adapts lessons over time like a dedicated private tutor — available 24/7.",
    mockup: (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-[8px] text-primary-foreground font-bold">AI</div>
          <div className="text-xs text-foreground">Personalized for you</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-lg p-2 text-center">
            <p className="text-primary text-sm font-bold">B1</p>
            <p className="text-[9px] text-muted-foreground">Your Level</p>
          </div>
          <div className="glass rounded-lg p-2 text-center">
            <p className="text-accent text-sm font-bold">87%</p>
            <p className="text-[9px] text-muted-foreground">Accuracy</p>
          </div>
        </div>
      </div>
    ),
  },
];

const FeatureDeepDive = () => {
  return (
    <section id="features" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Features</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Built for real fluency
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Forget flashcards. Practice the way native speakers actually communicate.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl overflow-hidden card-3d group"
            >
              {/* Mockup area */}
              <div className="bg-background/40 border-b border-border min-h-[140px] flex items-center">
                {f.mockup}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureDeepDive;
