import { motion } from "framer-motion";

const languages = [
  { name: "English", flag: "🇬🇧" },
  { name: "Spanish", flag: "🇪🇸" },
  { name: "Mandarin", flag: "🇨🇳" },
  { name: "Hindi", flag: "🇮🇳" },
  { name: "Arabic", flag: "🇸🇦" },
  { name: "French", flag: "🇫🇷" },
  { name: "Portuguese", flag: "🇧🇷" },
  { name: "Russian", flag: "🇷🇺" },
  { name: "Japanese", flag: "🇯🇵" },
  { name: "German", flag: "🇩🇪" },
  { name: "Korean", flag: "🇰🇷" },
  { name: "Italian", flag: "🇮🇹" },
  { name: "Turkish", flag: "🇹🇷" },
  { name: "Vietnamese", flag: "🇻🇳" },
  { name: "Thai", flag: "🇹🇭" },
  { name: "Swahili", flag: "🇰🇪" },
];

const LanguagesSection = () => {
  return (
    <section id="languages" className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            50 languages, one app
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From the most widely spoken to rising global languages — we've got you covered.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 max-w-4xl mx-auto">
          {languages.map((lang, i) => (
            <motion.div
              key={lang.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-card hover:shadow-card-hover transition-shadow cursor-default"
            >
              <span className="text-3xl">{lang.flag}</span>
              <span className="text-xs font-medium text-foreground">{lang.name}</span>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          …and 34 more languages available in the app.
        </p>
      </div>
    </section>
  );
};

export default LanguagesSection;
