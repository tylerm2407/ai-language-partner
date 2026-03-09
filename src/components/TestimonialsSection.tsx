import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Maria S.",
    location: "São Paulo, Brazil",
    text: "After 3 months with PolyChat Tutor, I finally felt confident ordering coffee in French on my Paris trip. The AI tutor felt like a real conversation partner!",
    rating: 5,
    avatar: "👩‍💼",
  },
  {
    name: "James T.",
    location: "London, UK",
    text: "I tried every language app out there. PolyChat Tutor is the only one that made me actually speak Japanese instead of just memorizing words.",
    rating: 5,
    avatar: "👨‍💻",
  },
  {
    name: "Aisha K.",
    location: "Dubai, UAE",
    text: "The writing feedback is incredible — it corrects my Mandarin characters in real time and explains why. The badges keep me coming back every day.",
    rating: 5,
    avatar: "👩‍🎓",
  },
  {
    name: "Lars W.",
    location: "Stockholm, Sweden",
    text: "My Spanish has improved more in 2 months with PolyChat Tutor than in a year of traditional classes. The daily streak feature keeps me accountable.",
    rating: 5,
    avatar: "🧑‍🏫",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Testimonials</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Loved by learners worldwide
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of people building real fluency with AI.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 card-3d relative"
            >
              <Quote className="h-6 w-6 text-primary/30 absolute top-4 right-4" />

              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s < t.rating ? "fill-primary text-primary" : "text-border"}`}
                  />
                ))}
              </div>

              <p className="text-sm text-foreground leading-relaxed mb-5">"{t.text}"</p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
