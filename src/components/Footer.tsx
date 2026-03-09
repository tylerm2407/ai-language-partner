import { Globe, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const footerLinks = {
  Product: ["Features", "Languages", "Pricing", "FAQ"],
  Company: ["About", "Blog", "Careers", "Contact"],
  Legal: ["Terms", "Privacy", "Cookies"],
};

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-16 text-card-foreground">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-10">
          {/* Brand + newsletter */}
          <div className="md:col-span-2">
            <a href="#" className="flex items-center gap-2 font-heading text-xl font-bold mb-4">
              <Globe className="h-6 w-6 text-primary" />
              Fluenci
            </a>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Get language learning tips and updates straight to your inbox.
            </p>
            <div className="flex gap-2 max-w-xs">
              <Input
                placeholder="Enter your email"
                type="email"
                className="text-sm"
              />
              <Button size="icon" className="gradient-primary border-0 text-primary-foreground shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-heading font-semibold text-sm mb-4 text-card-foreground">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-12 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Fluenci. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
