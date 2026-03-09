import { motion } from "framer-motion";
import { CalendarDays, MessageSquare, BookOpen, Award } from "lucide-react";

const timeline = [
  {
    icon: CalendarDays,
    time: "Day 1",
    title: "Choosing Spanish",
    description: "Maya downloads PolyChat Tutor, selects Spanish, and starts her first basic conversation with her AI tutor.",
    color: "from-primary to-primary/60",
  },
  {
    icon: MessageSquare,
    time: "Week 1",
    title: "Daily Conversations",
    description: "She practices ordering food, introducing herself, and asking for directions. The AI corrects her verb conjugations in real-time.",
    color: "from-[hsl(220,90%,60%)] to-[hsl(220,90%,40%)]",
  },
  {
    icon: BookOpen,
    time: "Week 2",
    title: "Reading & Writing",
    description: "Maya reads short Spanish stories and starts writing journal entries. The AI highlights errors and suggests natural phrasing.",
    color: "from-accent to-accent/60",
  },
  {
    icon: Award,
    time: "Week 4",
    title: "Confident Conversations",
    description: "With a 28-day streak and 3 badges earned, Maya holds her first full 10-minute conversation entirely in Spanish.",
    color: "from-yellow-500 to-orange-500",
  },
];

const StorySection = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-section" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">User Story</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Meet Maya
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            She's traveling to Spain in 3 months. Here's how PolyChat Tutor helped her prepare.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto relative">
          {/* Vertical timeline line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />

          {timeline.map((item, i) => (
            <motion.div
              key={item.time}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative flex items-start gap-6 mb-12 ${
                i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Timeline dot */}
              <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Content card */}
              <div className={`ml-16 md:ml-0 md:w-[calc(50%-40px)] ${i % 2 === 0 ? "md:pr-8 md:text-right" : "md:pl-8"}`}>
                <div className="glass rounded-2xl p-6 card-3d">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{item.time}</span>
                  <h3 className="font-heading text-lg font-semibold text-foreground mt-1 mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StorySection;
