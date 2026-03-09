import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

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
      "Badges & streaks",
      "Voice chat",
      "Priority support",
    ],
    cta: "Start Learning Today",
    featured: true,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free, upgrade when you're ready to go all-in on fluency.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`rounded-2xl p-8 ${
                plan.featured
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "bg-card shadow-card"
              }`}
            >
              <h3 className="font-heading text-xl font-bold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-heading text-4xl font-bold">{plan.price}</span>
                <span className={`text-sm ${plan.featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.period}
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full font-semibold ${
                  plan.featured
                    ? "bg-card text-foreground hover:bg-card/90"
                    : "gradient-primary text-primary-foreground border-0"
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
