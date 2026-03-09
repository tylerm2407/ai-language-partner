import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Maria S.",
    location: "São Paulo, Brazil",
    text: "After 3 months with Fluenci, I finally felt confident ordering coffee in French on my Paris trip. The AI tutor felt like a real conversation partner!",
    rating: 5,
  },
  {
    name: "James T.",
    location: "London, UK",
    text: "I tried every language app out there. Fluenci is the only one that made me actually speak Japanese instead of just memorizing words.",
    rating: 5,
  },
  {
    name: "Aisha K.",
    location: "Dubai, UAE",
    text: "The writing feedback is incredible — it corrects my Mandarin characters in real time and explains why. The badges keep me coming back every day.",
    rating: 5,
  },
  {
    name: "Lars W.",
    location: "Stockholm, Sweden",
    text: "My Spanish has improved more in 2 months with Fluenci than in a year of traditional classes. The daily streak feature keeps me accountable.",
    rating: 4,
  },
];

const TestimonialsSection = () => {
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
            Loved by learners worldwide
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of people building real fluency with AI.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-card p-6 shadow-card"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s < t.rating ? "fill-primary text-primary" : "text-border"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-4">"{t.text}"</p>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
