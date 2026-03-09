import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free Trial",
    price: "$0",
    period: "7 days",
    features: [
      "3 AI conversations per day",
      "5 languages",
      "Basic reading exercises",
      "Daily streak tracking",
    ],
    cta: "Start Free Trial",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    features: [
      "Unlimited AI conversations",
      "All 50 languages",
      "Reading & writing modes",
      "Achievement badges & streaks",
      "Voice chat",
      "Priority support",
    ],
    cta: "Start Learning Today",
    featured: true,
  },
  {
    name: "Family",
    price: "$29",
    period: "/month",
    features: [
      "Up to 5 family members",
      "All Pro features",
      "Shared progress dashboard",
      "Family challenges & badges",
    ],
    cta: "Get Family Plan",
    featured: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-section" />
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-accent/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free, upgrade when you're ready to go all-in on fluency.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl p-8 card-3d relative ${
                plan.featured
                  ? "glass border-primary/30 border shadow-glow"
                  : "glass"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="gradient-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </span>
                </div>
              )}

              <h3 className="font-heading text-xl font-bold mb-1 text-foreground">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full font-semibold ${
                  plan.featured
                    ? "gradient-primary text-primary-foreground border-0 shadow-glow"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                }`}
                size="lg"
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
