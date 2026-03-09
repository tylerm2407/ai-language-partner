import { motion } from "framer-motion";

const languages = [
  { name: "English", flag: "🇬🇧", speakers: "1.5B" },
  { name: "Mandarin", flag: "🇨🇳", speakers: "1.1B" },
  { name: "Hindi", flag: "🇮🇳", speakers: "609M" },
  { name: "Spanish", flag: "🇪🇸", speakers: "559M" },
  { name: "French", flag: "🇫🇷", speakers: "310M" },
  { name: "Arabic", flag: "🇸🇦", speakers: "274M" },
  { name: "Portuguese", flag: "🇧🇷", speakers: "264M" },
  { name: "Russian", flag: "🇷🇺", speakers: "255M" },
  { name: "Japanese", flag: "🇯🇵", speakers: "125M" },
  { name: "German", flag: "🇩🇪", speakers: "134M" },
  { name: "Korean", flag: "🇰🇷", speakers: "82M" },
  { name: "Italian", flag: "🇮🇹", speakers: "68M" },
  { name: "Turkish", flag: "🇹🇷", speakers: "88M" },
  { name: "Vietnamese", flag: "🇻🇳", speakers: "86M" },
  { name: "Thai", flag: "🇹🇭", speakers: "61M" },
  { name: "Swahili", flag: "🇰🇪", speakers: "200M" },
  { name: "Dutch", flag: "🇳🇱", speakers: "30M" },
  { name: "Polish", flag: "🇵🇱", speakers: "45M" },
  { name: "Greek", flag: "🇬🇷", speakers: "13M" },
  { name: "Swedish", flag: "🇸🇪", speakers: "13M" },
];

const LanguagesSection = () => {
  return (
    <section id="languages" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-section" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-[200px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Languages</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            50 languages, one app
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From the most widely spoken to rising global languages — PolyChat Tutor has you covered.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {languages.map((lang, i) => (
            <motion.div
              key={lang.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-xl p-4 flex flex-col items-center gap-2 card-3d cursor-default group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{lang.flag}</span>
              <span className="text-sm font-semibold text-foreground">{lang.name}</span>
              <span className="text-[10px] text-muted-foreground">{lang.speakers} speakers</span>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          …and 30 more languages available in the app.
        </p>
      </div>
    </section>
  );
};

export default LanguagesSection;
