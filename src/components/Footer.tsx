import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const footerLinks = {
  Product: ["Features", "Languages", "Pricing", "FAQ"],
  Company: ["About", "Blog", "Careers", "Contact"],
  Legal: ["Terms", "Privacy", "Cookies"],
};

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-10">
          <div className="md:col-span-2">
            <a href="#" className="flex items-center gap-2.5 font-heading text-xl font-bold mb-4 text-foreground">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              PolyChat Tutor
            </a>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Get language learning tips and updates straight to your inbox.
            </p>
            <div className="flex gap-2 max-w-xs">
              <Input placeholder="Enter your email" type="email" className="text-sm bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
              <Button size="icon" className="gradient-primary border-0 text-primary-foreground shrink-0 shadow-glow">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-heading font-semibold text-sm mb-4 text-foreground">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
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
            © 2026 PolyChat Tutor. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
