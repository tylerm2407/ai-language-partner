import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { STRIPE_TIERS } from "@/lib/plan";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPlan } from "@/hooks/useUserPlan";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tier: "free" as const,
    features: [
      "All 50 language courses",
      "10 min daily AI chat",
      "Daily streak tracking",
      "Community leaderboard",
    ],
    cta: "Get Started Free",
    featured: false,
  },
  {
    name: "Basic",
    price: "$9.99",
    period: "/month",
    tier: "basic" as const,
    features: [
      "All 50 language courses",
      "20 min daily AI chat",
      "Writing feedback",
      "Daily streak tracking",
      "Community leaderboard",
    ],
    cta: "Start Basic",
    featured: false,
  },
  {
    name: "Pro",
    price: "$24.99",
    period: "/month",
    tier: "pro" as const,
    features: [
      "Everything in Basic",
      "45 min daily AI chat",
      "Voice driving mode",
      "Personalized AI tutor",
      "Priority support",
    ],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "VIP",
    price: "$29.99",
    period: "/month",
    tier: "vip" as const,
    features: [
      "Everything in Pro",
      "60 min daily AI chat",
      "Early access to features",
      "Exclusive VIP badge",
      "Dedicated support",
    ],
    cta: "Go VIP",
    featured: false,
  },
];

const PricingSection = () => {
  const { user } = useAuth();
  const { plan: currentPlan } = useUserPlan();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleCheckout = async (tier: "basic" | "pro" | "vip") => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLoadingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: STRIPE_TIERS[tier].price_id },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-section" />
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-accent/3 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-5xl font-bold mb-4 text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Choose the plan that fits your learning goals.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => {
            const isCurrentPlan = currentPlan === plan.tier;
            const isLoading = loadingTier === plan.tier;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-6 sm:p-8 relative ${
                  plan.featured
                    ? "glass border-primary/30 border shadow-glow"
                    : "glass"
                } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="gradient-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Your Plan
                    </span>
                  </div>
                )}

                <h3 className="font-heading text-xl font-bold mb-1 text-foreground">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-heading text-3xl sm:text-4xl font-bold text-foreground">{plan.price}</span>
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
                  className={`w-full font-semibold min-h-[48px] ${
                    plan.featured
                      ? "gradient-primary text-primary-foreground border-0 shadow-glow"
                      : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                  }`}
                  size="lg"
                  disabled={isCurrentPlan || isLoading}
                  onClick={() => plan.tier === "free" ? navigate(user ? "/dashboard" : "/login") : handleCheckout(plan.tier)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    <>
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
