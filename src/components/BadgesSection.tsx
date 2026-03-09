import { motion } from "framer-motion";
import { Flame, Trophy, BookOpen, MessageSquare, Star, Target } from "lucide-react";

const badges = [
  { icon: Flame, label: "7-Day Streak", color: "from-orange-500 to-red-500" },
  { icon: MessageSquare, label: "First 100 Conversations", color: "from-primary to-[hsl(220,90%,60%)]" },
  { icon: Trophy, label: "Grammar Master", color: "from-yellow-500 to-orange-500" },
  { icon: BookOpen, label: "Reading Explorer", color: "from-[hsl(220,90%,60%)] to-accent" },
  { icon: Star, label: "Perfect Week", color: "from-primary to-emerald-400" },
  { icon: Target, label: "Level Up!", color: "from-accent to-pink-500" },
];

const streakDays = [
  { day: "Mon", active: true },
  { day: "Tue", active: true },
  { day: "Wed", active: true },
  { day: "Thu", active: true },
  { day: "Fri", active: true },
  { day: "Sat", active: false },
  { day: "Sun", active: false },
];

const BadgesSection = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-accent font-semibold text-sm uppercase tracking-wider mb-3">Gamification</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Earn badges & build streaks
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Stay motivated with achievement badges, daily streaks, and progress milestones.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Badges grid */}
          <div className="grid grid-cols-3 gap-4">
            {badges.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-2xl p-5 flex flex-col items-center gap-3 card-3d group"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <badge.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">{badge.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Streak counter */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8"
          >
            <div className="text-center mb-6">
              <Flame className="h-12 w-12 text-orange-500 mx-auto mb-2" />
              <p className="font-heading text-5xl font-bold text-foreground">5</p>
              <p className="text-muted-foreground text-sm">Day Streak</p>
            </div>

            <div className="flex justify-center gap-3">
              {streakDays.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      d.active
                        ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {d.active ? "🔥" : ""}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Keep your streak alive! Daily push notifications & in-app reminders help you stay on track.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BadgesSection;
