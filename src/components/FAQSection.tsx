import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does the AI language tutor work?",
    a: "Our AI tutor uses advanced language models to hold natural conversations with you in your target language. It corrects mistakes in real-time, explains grammar rules, and adapts to your proficiency level over time.",
  },
  {
    q: "Which languages are supported?",
    a: "PolyChat Tutor supports the 50 most commonly spoken languages worldwide, including English, Spanish, Mandarin, Hindi, Arabic, French, Portuguese, Russian, Japanese, German, Korean, and many more.",
  },
  {
    q: "Can I practice reading and writing too?",
    a: "Absolutely! Beyond conversations, PolyChat Tutor offers reading practice with tap-to-translate, and writing feedback where the AI annotates your text with corrections and suggestions.",
  },
  {
    q: "How do streaks and badges work?",
    a: "Complete at least one lesson per day to maintain your streak. You'll earn achievement badges for milestones like '7-Day Streak,' 'First 100 Conversations,' and 'Grammar Master.' Push notifications help you stay on track.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Start with a 7-day free trial that includes 3 AI conversations per day and access to 5 languages. Upgrade to Pro for unlimited access to all features and all 50 languages.",
  },
  {
    q: "Can I use PolyChat Tutor on mobile?",
    a: "Yes, PolyChat Tutor is fully optimized for mobile, tablet, and desktop. Practice anytime, anywhere.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-24 md:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Frequently asked questions
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <AccordionItem value={`item-${i}`} className="glass rounded-xl border-0 px-6 overflow-hidden">
                  <AccordionTrigger className="text-sm font-semibold text-foreground hover:text-primary hover:no-underline py-5">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
