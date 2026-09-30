import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, X, HelpCircle, User, Moon, Sun, Menu, ShoppingCart, CreditCard, CheckCircle2, AlertCircle, Send, LoaderCircle, MapPin, Truck, Clock, Home } from 'lucide-react';
import QuantityInput from '@/components/customer/QuantityInput';
import { IN_TOWN_MUNICIPALITY, MUNICIPALITIES, MUNICIPALITY_ALSO_KNOWN_AS } from '@/constants/municipalities';

export default function Welcome() {
    const { props: pageProps } = usePage() as any;
    const flash = pageProps?.flash || {};
    // Sent by the home route from DeliveryFeeSetting and the order
    // controller's own minimum, so these cannot drift from what is
    // actually charged. Fallbacks are only for a stale cached page.
    const delivery = pageProps?.delivery ?? {};
    const inTownFee = Number(delivery.in_town_fee ?? 20);
    const outOfTownFee = Number(delivery.out_of_town_fee ?? 30);
    const minimumOrder = Number(delivery.minimum_order ?? 200);
    const inTownMunicipality = delivery.in_town_municipality ?? IN_TOWN_MUNICIPALITY;
    const {
        data: contactData,
        setData: setContactData,
        post: postContact,
        processing: contactProcessing,
        errors: contactErrors,
        reset: resetContact,
        recentlySuccessful: contactRecentlySuccessful,
    } = useForm({
        name: '',
        email: '',
        phone: '',
        message: '',
        website: '', // honeypot field, kept empty by real visitors
    });

    const submitContact = (e: React.FormEvent) => {
        e.preventDefault();
        postContact(route('contact.send'), {
            preserveScroll: true,
            onSuccess: () => resetContact('name', 'email', 'phone', 'message'),
        });
    };

    const [currentIndex, setCurrentIndex] = useState(0);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);
    const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);

    // Close whichever modal is open with the Escape key.
    useEffect(() => {
        if (!showFaqModal && !showProductModal) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showFaqModal) setShowFaqModal(false);
            else if (showProductModal) setShowProductModal(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showFaqModal, showProductModal]);
    const [productQty, setProductQty] = useState<number>(1);
    // Only meaningful when a beverage's Case unit is selected: the store
    // only offers a chilled option by the case, never by the bottle.
    const [selectedCold, setSelectedCold] = useState<boolean>(false);
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('darkMode') === 'true';
        }
        return false;
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('home');
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);

    // Track active section via IntersectionObserver
    useEffect(() => {
        const sections = ['home', 'about', 'products', 'contact'];
        const observers: IntersectionObserver[] = [];

        sections.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) setActiveSection(id);
                },
                { threshold: 0.4 }
            );
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach((obs) => obs.disconnect());
    }, []);

    // Apply dark mode to HTML element and save to localStorage
    useEffect(() => {
        const html = document.documentElement;
        if (darkMode) {
            html.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            html.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        }
    }, [darkMode]);

    const kiloPricing = [
        { kilo: 1, price: 10 },
        { kilo: 3, price: 30 },
        { kilo: 5, price: 40 },
        { kilo: 10, price: 90 },
        { kilo: 20, price: 160 },
        { kilo: 30, price: 210 },
        { kilo: 40, price: 230 },
        { kilo: 50, price: 250 },
    ];

    const products = [
        {
            name: 'Purified Ice Tubes',
            category: 'Ice Tubes',
            image: '/images/icetube.jpg',
            description: 'Crystal-clear ice tubes designed to keep your beverages perfectly chilled without diluting taste',
            heroTagline: 'The perfect ice for Redhorse, San Mig Light & more!',
            tag: 'Perfect for Every Drink',
            price: '₱10/kg • Up to 50kg',
            availability: 'Always Available',
            details: 'High-quality ice tubes that melt slowly, keeping your drinks cold without diluting the flavor. Tiered pricing: 1kg=₱10, 3kg=₱30, 5kg=₱40, 10kg=₱90, 20kg=₱160, 30kg=₱210, 40kg=₱230, 50kg=₱250. Maximum capacity: 50kg per order.'
        },
        {
            name: 'Redhorse Beer',
            category: 'Beverages',
            image: '/images/redhorse.jpg',
            description: 'The extra-strong beer for bold moments and great times with friends',
            heroTagline: 'Get the perfect ice for your Redhorse!',
            tag: 'Extra Strong Beer',
            price: '₱750/case (₱770 cold) • ₱65/bottle',
            availability: 'In Stock',
            details: 'Strong, full-bodied beer with 8% alcohol content. Perfect for those who prefer a robust drinking experience. Case: 12 bottles (₱750 regular, ₱770 cold), Bottle: ₱65 each.'
        },
        {
            name: 'San Mig Light',
            category: 'Beverages',
            image: '/images/sanmiglight.jpg',
            description: 'Light and refreshing beer perfect for easy drinking and social gatherings',
            heroTagline: 'Get the perfect ice for your San Mig Light!',
            tag: 'Light & Refreshing',
            price: '₱1,250/case (₱1,300 cold) • ₱54.17/bottle',
            availability: 'In Stock',
            details: 'Low-calorie light beer with smooth taste. Ideal for long drinking sessions and social events. Case: 24 bottles (₱1,250 regular, ₱1,300 cold), Bottle: ₱54.17 each.'
        },
        {
            name: 'San Mig Apple',
            category: 'Beverages',
            image: '/images/sanmigapple.jpg',
            description: 'Sweet apple-flavored beer with a crisp and refreshing taste',
            heroTagline: 'Get the perfect ice for your San Mig Apple!',
            tag: 'Sweet Apple Flavor',
            price: '₱1,050/case (₱1,100 cold) • ₱45.83/bottle',
            availability: 'Limited Stock',
            details: 'Unique apple-flavored beer with a sweet and refreshing taste. A favorite among younger drinkers. Case: 24 bottles (₱1,050 regular, ₱1,100 cold), Bottle: ₱45.83 each.'
        },
        {
            name: 'San Mig Pilsen',
            category: 'Beverages',
            image: '/images/pilsen.jpg',
            description: 'Classic Filipino beer with traditional taste and quality',
            heroTagline: 'Get the perfect ice for your San Mig Pilsen!',
            tag: 'The Classic Choice',
            price: '₱1,100/case (₱1,150 cold) • ₱47.92/bottle',
            availability: 'In Stock',
            details: 'The original Filipino beer with a classic taste. Perfect for any occasion. Case: 24 bottles (₱1,100 regular, ₱1,150 cold), Bottle: ₱47.92 each.'
        }
    ];

    // Auto-slide functionality
    useEffect(() => {
        if (isCarouselPaused) return;
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => {
                const nextIndex = prevIndex + 1;
                if (nextIndex >= products.length * 2) {
                    // Reset to first slide without transition
                    const container = document.querySelector('.carousel-container') as HTMLElement;
                    if (container) {
                        container.style.transition = 'none';
                        container.style.transform = `translateX(0%)`;
                        setTimeout(() => {
                            container.style.transition = '';
                        }, 50);
                    }
                    return 0;
                }
                return nextIndex;
            });
        }, 5000); // Change slide every 5 seconds

        return () => clearInterval(interval); // Cleanup on unmount
    }, [products.length, isCarouselPaused]);

    const nextSlide = () => {
        setCurrentIndex((prevIndex) => {
            if (prevIndex >= products.length * 2 - 1) {
                return 0;
            }
            return prevIndex + 1;
        });
    };

    const prevSlide = () => {
        setCurrentIndex((prevIndex) => {
            if (prevIndex <= 0) {
                return products.length * 2 - 1;
            }
            return prevIndex - 1;
        });
    };

    // `case` is the regular (default) case price; `caseCold` is the premium
    // chilled case price, only ever offered by the case (never the bottle).
    const beveragePrices: { [key: string]: { case: number; caseCold: number; bottle: number } } = {
        'Redhorse Beer': { case: 750, caseCold: 770, bottle: 65 },
        'San Mig Light': { case: 1250, caseCold: 1300, bottle: 54.17 },
        'San Mig Apple': { case: 1050, caseCold: 1100, bottle: 45.83 },
        'San Mig Pilsen': { case: 1100, caseCold: 1150, bottle: 47.92 },
    };

    // Returns the list of purchasable units (weight tier or case/bottle) for a product's dropdown selector
    const getProductUnits = (product: typeof products[0]): { label: string; price: number }[] => {
        if (product.name === 'Purified Ice Tubes') {
            return kiloPricing.map((t) => ({ label: `${t.kilo}kg`, price: t.price }));
        }
        const pricing = beveragePrices[product.name];
        if (!pricing) return [];
        return [
            { label: 'Case', price: pricing.case },
            { label: 'Bottle', price: pricing.bottle },
        ];
    };

    const faqs = [
        {
            question: "Pricing",
            details: "How much per kilo of ice tubes? Minimum kilo order? Discount for bulk?",
            answer: "Our ice tubes are priced affordably per kilo with a minimum order of just 1 kilo. We offer competitive bulk discounts for orders above 20kg. Contact us for current pricing and special rates for large orders."
        },
        {
            question: "Delivery",
            details: "Can you deliver per kilo? Delivery fee based on weight or distance? Same-day delivery?",
            answer: "Yes, we deliver per kilo! Delivery fees are based on distance within our service area. We offer same-day delivery for orders placed before 12 PM. Delivery is available daily from 9 AM until 5:30 PM."
        },
        {
            question: "Packaging",
            details: "How are ice tubes packed per kilo to avoid melting?",
            answer: "Our ice tubes are professionally packed in insulated packaging designed to minimize melting. Each kilo is sealed in waterproof bags with additional insulation layers to maintain temperature during transport."
        },
        {
            question: "Quality Assurance",
            details: "Cleanliness of Product",
            answer: "We maintain strict hygiene standards with purified water and regular equipment sanitization. Our ice production facility follows food safety guidelines to ensure clean, safe, and high-quality ice tubes."
        },
        {
            question: "Ordering",
            details: "How many kilos can I order? Is there a maximum?",
            answer: "You can order from 1 kilo up to 50kg maximum per delivery. For larger commercial needs, please contact us directly for special arrangements and pricing."
        },
        {
            question: "Storage Tips",
            details: "How many kilos fit in an icebox? How long will X kilos last?",
            answer: "A standard icebox typically holds 10-15kg. Ice tubes last 6-8 hours in a well-insulated container. For longer storage, keep in a freezer where they can last for weeks."
        },
        {
            question: "Payment Options",
            details: "",
            answer: "We accept cash on delivery and GCash. Payment is due upon delivery unless prior arrangements are made."
        },
        {
            question: "Customer Container Policy",
            details: "",
            answer: "You can provide your own clean containers for ice packaging. We ensure proper handling and hygiene when using customer-provided containers. Additional charges may apply for special packaging requests."
        },
        {
            question: "Changes or Cancellation",
            details: "Can I change or cancel my order after placing it? Any cancellation fees?",
            answer: "Orders can be modified or cancelled up to 2 hours before delivery time without penalty. Cancellations within 2 hours of delivery may incur a small fee to cover preparation costs."
        }
    ];



    return (
        <>
            <Head title="Mejeck IcePlant - Purified Ice Solutions" />

            <div className={`min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300`}>
                {/* Navigation Header */}
                <header className="sticky top-0 z-50 bg-slate-50 dark:bg-slate-800 shadow-lg border-b border-gray-200 dark:border-slate-600 transition-colors duration-300 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-20">
                            {/* Logo */}
                            <div className="flex items-center -translate-x-16 sm:-translate-x-20 lg:-translate-x-28">
                                <div className="flex-shrink-0">
                                    <div className="flex items-center">
                                        <img
                                            src="/images/LOGO.jpg"
                                            alt="Mejeck IcePlant Logo"
                                            className="w-10 h-10 rounded-lg object-cover mr-3"
                                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                                const target = e.currentTarget;
                                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect fill='%2306b6d4' width='40' height='40' rx='8'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23ffffff' font-family='Arial' font-size='14' font-weight='bold'%3EMI%3C/text%3E%3C/svg%3E";
                                            }}
                                        />
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mejeck IcePlant</h1>
                                            <p className="text-sm text-cyan-600 dark:text-cyan-400">Purified Ice Tubes</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Links */}
                            <nav className="hidden md:flex items-center space-x-6 translate-x-24 sm:translate-x-32 lg:translate-x-40">
                                {[
                                    { id: 'home', label: 'HOME', href: '#home' },
                                    { id: 'about', label: 'ABOUT US', href: '#about' },
                                    { id: 'products', label: 'OUR PRODUCTS', href: '#products' },
                                    { id: 'contact', label: 'CONTACT US', href: '#contact' },
                                ].map(({ id, label, href }) => (
                                    <a
                                        key={id}
                                        href={href}
                                        className={`inline-flex items-center px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200 ${
                                            activeSection === id
                                                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                                : 'border-transparent text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400'
                                        }`}
                                    >
                                        {label}
                                    </a>
                                ))}
                                <button
                                    onClick={() => setShowFaqModal(true)}
                                    className="inline-flex items-center text-gray-900 dark:text-white px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 border-transparent hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors duration-200"
                                >
                                    <HelpCircle className="w-4 h-4 mr-2" />
                                    FAQS
                                </button>
                            </nav>

                            {/* Mobile Header Actions */}
                            <div className="md:hidden flex items-center gap-2">
                                {/* Dark Mode Toggle */}
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                </button>

                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <Menu className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Right Side Actions */}
                            <div className="hidden md:flex items-center space-x-4 translate-x-16 sm:translate-x-20 lg:translate-x-32">
                                {/* Dashboard Button */}
                                <a
                                    href="/login"
                                    className="inline-flex items-center text-gray-900 dark:text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
                                >
                                    <User className="w-4 h-4 mr-2" />
                                    Login
                                </a>

                                {/* Dark Mode Toggle */}
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-lg">
                        <div className="px-4 py-4 space-y-3">
                            <a href="#home" onClick={() => setMobileMenuOpen(false)} className="block text-gray-900 dark:text-white px-4 py-2 text-sm font-medium">HOME</a>
                            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block text-gray-900 dark:text-white px-4 py-2 text-sm font-medium">ABOUT US</a>
                            <a href="#products" onClick={() => setMobileMenuOpen(false)} className="block text-gray-900 dark:text-white px-4 py-2 text-sm font-medium">OUR PRODUCTS</a>
                            <button
                                onClick={() => {
                                    setShowFaqModal(true);
                                    setMobileMenuOpen(false);
                                }}
                                className="block w-full text-left text-gray-900 dark:text-white px-4 py-2 text-sm font-medium"
                            >
                                <HelpCircle className="w-4 h-4 inline mr-2" />
                                FAQS
                            </button>
                            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block text-gray-900 dark:text-white px-4 py-2 text-sm font-medium">CONTACT US</a>

                            <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                                <a
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-4 py-2.5 text-sm font-semibold hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors mt-2"
                                >
                                    <User className="w-4 h-4" />
                                    Login
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content - Will blur when FAQ or Product modal is open */}
                <div className={`transition-all duration-300 ${showFaqModal || showProductModal ? 'blur-sm pointer-events-none' : ''}`}>

                {/* Hero Carousel Section */}
                <section id="home" className="relative min-h-[calc(100vh-5rem)]">
                    <div
                        className="relative h-[calc(100vh-5rem)] overflow-hidden"
                        onMouseEnter={() => setIsCarouselPaused(true)}
                        onMouseLeave={() => setIsCarouselPaused(false)}
                    >
                        <div className="carousel-container flex transition-transform duration-500 ease-in-out h-full" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                            {[...products, ...products].map((product, index) => (
                                <div key={index} className="w-full flex-shrink-0 h-[calc(100vh-5rem)]">
                                    <div className="relative h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                                        <img 
                                            src={product.image} 
                                            alt={product.name} 
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/30">
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-8">
                                                <div className="max-w-4xl mx-auto text-center">
                                                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white mb-6 drop-shadow-lg">{product.name}</h1>
                                                    <p className="text-xl sm:text-2xl md:text-3xl text-white/90 mb-6 drop-shadow">{product.description}</p>
                                                    <div className="mb-6">
                                                        <span className="inline-block bg-white/20 backdrop-blur-sm px-5 py-2 rounded-full text-base text-white font-semibold">
                                                            {product.tag}
                                                        </span>
                                                    </div>
                                                    <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 max-w-xl mx-auto border border-white/20">
                                                        <p className="text-white text-sm mb-3">{product.heroTagline}</p>
                                                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                                            <a href="tel:+639686001910" className="inline-block whitespace-nowrap bg-white text-cyan-600 px-4 py-2 rounded-full font-semibold text-sm hover:bg-cyan-50 transition-colors shadow-lg">
                                                                ORDER NOW: +63 (968) 600-1910
                                                            </a>
                                                            <a href="#products" className="inline-block whitespace-nowrap bg-cyan-500/80 text-white px-4 py-2 rounded-full font-semibold text-sm hover:bg-cyan-500 transition-colors shadow-lg border border-white/30">
                                                                View Our Products
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Navigation Buttons */}
                        <button 
                            onClick={prevSlide}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 hover:bg-white transition-colors shadow-lg z-10"
                        >
                            <ChevronLeft className="w-6 h-6 text-gray-800" />
                        </button>
                        <button 
                            onClick={nextSlide}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-3 hover:bg-white transition-colors shadow-lg z-10"
                        >
                            <ChevronRight className="w-6 h-6 text-gray-800" />
                        </button>
                        
                        {/* Indicators */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                            {products.map((_, index) => {
                                const isActive = currentIndex === index || currentIndex === index + products.length;
                                return (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentIndex(index)}
                                        className={`w-3 h-3 rounded-full transition-colors ${
                                            isActive ? 'bg-white' : 'bg-white/50'
                                        }`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    {/* Scroll-down cue */}
                    <a
                        href="#about"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10 flex flex-col items-center text-cyan-600 dark:text-cyan-400 animate-bounce"
                        aria-label="Scroll down"
                    >
                        <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg border border-gray-100 dark:border-slate-600">
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </a>
                </section>

                {/* About Us Section */}
                <section id="about" className="py-20 bg-gray-50 dark:bg-slate-800 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="mb-4">
                                    <p className="text-cyan-600 dark:text-cyan-400 font-semibold text-lg mb-2">WHO WE ARE</p>
                                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                        Moving Forward with Every Cube
                                    </h2>
                                </div>
                                <div className="prose prose-base text-gray-600 dark:text-gray-300 space-y-3">
                                    <p>
                                        Welcome to Mejeck Purified Iceplant, your trusted provider of high-quality tube ice serving the local community. Established in October of the previous year, the business has been committed to delivering purified tube ice to households and business clients alike. Open daily from 9:00 AM to 10:00 PM, with deliveries available until 5:30 PM, Mejeck Iceplant takes pride in its reliable service, offering tube ice by kilo or box with a maximum capacity of 50kg.
                                    </p>
                                    <p>
                                        Mejeck IcePlant is your premier supplier of high-quality ice tubes specifically designed 
                                        for the perfect beverage experience. We specialize in providing crystal-clear ice tubes 
                                        that enhance the flavor and presentation of your favorite drinks.
                                    </p>
                                    <p>
                                        Our ice tubes are perfectly crafted to complement popular Filipino beverages like 
                                        Redhorse, San Mig Light, San Mig Apple, and San Mig Pilsen. Each tube is designed 
                                        to melt slowly, keeping your drinks cold without diluting the taste too quickly.
                                    </p>
                                    <p>
                                        Whether you're hosting a party, running a bar, or just enjoying a cold drink at home, 
                                        Mejeck IcePlant delivers the perfect ice solution for every occasion. Quality, freshness, 
                                        and customer satisfaction are our top priorities.
                                    </p>
                                </div>
                                <div className="mt-8 flex flex-wrap gap-4">
                                    <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 flex-1 min-w-[200px]">
                                        <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">50 kg</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">Per Order Capacity</div>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex-1 min-w-[200px]">
                                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-1">₱10 / kg</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">Starting Price for Ice</div>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 flex-1 min-w-[200px]">
                                        <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">Daily</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">9AM–10PM Open</div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <img 
                                    src="/images/ALLIN.png" 
                                    alt="Purified Ice Products" 
                                    className="rounded-2xl shadow-2xl w-full"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                        const target = e.currentTarget;
                                        target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect fill='%23e0f2fe' width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%230284c7' font-family='Arial' font-size='24'%3EIce Products Image%3C/text%3E%3C/svg%3E";
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Delivery Areas Section — reads the same MUNICIPALITIES list
                    the checkout dropdown is built from, so this can never
                    promise a town the order form would refuse. */}
                <section id="delivery" className="py-20 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <div className="inline-flex items-center gap-2 bg-cyan-500/10 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                                <Truck className="w-4 h-4" />
                                Delivery
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                We Deliver in Selected Areas
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                                Order online and we will bring the ice to you. These are the towns we currently serve.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
                            {MUNICIPALITIES.map((municipality) => {
                                const isInTown = municipality === inTownMunicipality;
                                const alsoKnownAs = MUNICIPALITY_ALSO_KNOWN_AS[municipality];

                                return (
                                    <div
                                        key={municipality}
                                        className={`flex items-start gap-3 rounded-xl border-2 p-4 transition-colors ${
                                            isInTown
                                                ? 'border-cyan-500 bg-white dark:bg-slate-800 dark:border-cyan-400 shadow-md'
                                                : 'border-gray-200 bg-white/70 dark:bg-slate-800/70 dark:border-slate-700'
                                        }`}
                                    >
                                        {isInTown ? (
                                            <Home className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-white leading-snug">
                                                {municipality}
                                            </p>
                                            {alsoKnownAs && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    also known as {alsoKnownAs}
                                                </p>
                                            )}
                                            {isInTown && (
                                                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mt-0.5">
                                                    Our home town
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                    <Truck className="w-4 h-4" />
                                    Delivery fee
                                </div>
                                <p className="text-gray-900 dark:text-white font-bold text-lg">
                                    ₱{inTownFee.toFixed(2)}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> within {inTownMunicipality}</span>
                                </p>
                                <p className="text-gray-900 dark:text-white font-bold text-lg">
                                    ₱{outOfTownFee.toFixed(2)}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> for the other towns</span>
                                </p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                    <ShoppingCart className="w-4 h-4" />
                                    Minimum order
                                </div>
                                <p className="text-gray-900 dark:text-white font-bold text-lg">₱{minimumOrder.toFixed(2)}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">for delivery orders</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                    <Clock className="w-4 h-4" />
                                    Delivery hours
                                </div>
                                <p className="text-gray-900 dark:text-white font-bold text-lg">9:00 AM – 5:30 PM</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">daily</p>
                            </div>
                        </div>

                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
                            Outside these areas? You are welcome to pick up your order at the plant —
                            {' '}<a href="#contact" className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">get in touch</a>{' '}
                            and we will sort it out.
                        </p>
                    </div>
                </section>

                {/* Our Products Section */}
                <section id="products" className="py-20 bg-white dark:bg-slate-900 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Our Products</h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                                Click on any product to view details and place your order
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {products.map((product, index) => (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            setSelectedProduct(product);
                                            setSelectedUnitIndex(0);
                                            setProductQty(1);
                                            setSelectedCold(false);
                                            setShowProductModal(true);
                                        }}
                                        className="group bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 dark:border-slate-700"
                                    >
                                        <div className="relative h-56 overflow-hidden">
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                                    const target = e.currentTarget;
                                                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23e0f2fe' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%230284c7' font-family='Arial' font-size='20'%3EProduct Image%3C/text%3E%3C/svg%3E";
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="absolute bottom-4 left-4 right-4">
                                                    <span className="inline-block bg-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                                        View Details
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <div className="flex flex-col gap-1 mb-3">
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{product.name}</h3>
                                                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm break-words">{product.price}</span>
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2 leading-relaxed">{product.description}</p>
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
                                                <span className="text-xs font-medium px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-full">
                                                    {product.tag}
                                                </span>
                                                <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                                                    product.availability === 'In Stock' ? 'bg-green-100 text-green-700' :
                                                    product.availability === 'Limited Stock' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {product.availability}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section id="contact" className="py-20 bg-gradient-to-br from-cyan-600 to-blue-700 dark:from-slate-800 dark:to-slate-900">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-4">Get In Touch</h2>
                            <p className="text-lg text-cyan-100 dark:text-cyan-200 max-w-3xl mx-auto mb-4">
                                Ready to get the perfect ice tubes for your favorite beverages? Contact us today for orders!
                            </p>
                            {/* Business hours badge */}
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium border border-white/30">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    Open Daily: 9:00 AM – 10:00 PM
                                </span>
                                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium border border-white/30">
                                    <span className="w-2 h-2 bg-amber-300 rounded-full"></span>
                                    Delivery Until: 5:30 PM
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {/* Phone */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Phone</h3>
                                <p className="text-cyan-100 mb-2">Call us for orders and inquiries</p>
                                <a href="tel:+639686001910" className="text-white font-bold hover:text-cyan-200 transition-colors">
                                    0907 461 9915
                                </a>
                            </div>
                            {/* Email */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Email</h3>
                                <p className="text-cyan-100 mb-2">Send us your inquiries</p>
                                <a href="mailto:harrismanabat3@gmail.com" className="text-white font-bold hover:text-cyan-200 transition-colors break-all">
                                    harrismanabat3@gmail.com
                                </a>
                            </div>
                            {/* Facebook Messenger */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0C5.374 0 0 4.975 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.626 0 12-4.974 12-11.111C24 4.975 18.626 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.131 3.26L19.752 8.1l-6.561 6.863z"/>
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Facebook</h3>
                                <p className="text-cyan-100 mb-2">Message us on Messenger</p>
                                <a
                                    href="https://www.facebook.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white font-bold hover:text-cyan-200 transition-colors"
                                >
                                    Mejeck IcePlant
                                </a>
                            </div>
                            {/* Location */}
                            <div
                                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all cursor-pointer"
                                onClick={() => window.open('https://www.google.com/maps/@15.3529498,121.0027001,15z', '_blank')}
                            >
                                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 relative">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Location</h3>
                                <p className="text-cyan-100 mb-2">Visit our ice plant</p>
                                <div className="text-white font-bold text-sm">
                                    Lacuna St. Pob. 2 Penaranda, Nueva Ecija
                                </div>
                            </div>
                        </div>
                        {/* Contact Form */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
                            <div className="lg:col-span-3 bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20">
                                <h3 className="text-xl font-semibold text-white mb-1">Send Us a Message</h3>
                                <p className="text-cyan-100 text-sm mb-6">
                                    Fill out the form below and we'll reply straight to your email.
                                </p>

                                {flash.success && (
                                    <div className="flex items-start gap-2 p-3 mb-5 bg-green-500/20 border border-green-400/40 rounded-lg text-white text-sm">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{flash.success}</span>
                                    </div>
                                )}
                                {flash.error && (
                                    <div className="flex items-start gap-2 p-3 mb-5 bg-red-500/20 border border-red-400/40 rounded-lg text-white text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{flash.error}</span>
                                    </div>
                                )}

                                <form onSubmit={submitContact} className="space-y-4" noValidate>
                                    {/* Honeypot - hidden from real users, only bots fill this in */}
                                    <input
                                        type="text"
                                        name="website"
                                        value={contactData.website}
                                        onChange={(e) => setContactData('website', e.target.value)}
                                        tabIndex={-1}
                                        autoComplete="off"
                                        className="hidden"
                                        aria-hidden="true"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="contact-name" className="block text-sm font-medium text-cyan-100 mb-1">
                                                Full Name
                                            </label>
                                            <input
                                                id="contact-name"
                                                type="text"
                                                value={contactData.name}
                                                onChange={(e) => setContactData('name', e.target.value)}
                                                placeholder="Juan Dela Cruz"
                                                className="w-full rounded-lg bg-white/90 text-gray-900 placeholder-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                                            />
                                            {contactErrors.name && (
                                                <p className="mt-1 text-xs text-red-200">{contactErrors.name}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label htmlFor="contact-email" className="block text-sm font-medium text-cyan-100 mb-1">
                                                Email Address
                                            </label>
                                            <input
                                                id="contact-email"
                                                type="email"
                                                value={contactData.email}
                                                onChange={(e) => setContactData('email', e.target.value)}
                                                placeholder="you@example.com"
                                                className="w-full rounded-lg bg-white/90 text-gray-900 placeholder-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                                            />
                                            {contactErrors.email && (
                                                <p className="mt-1 text-xs text-red-200">{contactErrors.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="contact-phone" className="block text-sm font-medium text-cyan-100 mb-1">
                                            Phone Number <span className="text-cyan-300">(optional)</span>
                                        </label>
                                        <input
                                            id="contact-phone"
                                            type="tel"
                                            value={contactData.phone}
                                            onChange={(e) => setContactData('phone', e.target.value)}
                                            placeholder="09XX XXX XXXX"
                                            className="w-full rounded-lg bg-white/90 text-gray-900 placeholder-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                                        />
                                        {contactErrors.phone && (
                                            <p className="mt-1 text-xs text-red-200">{contactErrors.phone}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor="contact-message" className="block text-sm font-medium text-cyan-100 mb-1">
                                            Message
                                        </label>
                                        <textarea
                                            id="contact-message"
                                            rows={4}
                                            value={contactData.message}
                                            onChange={(e) => setContactData('message', e.target.value)}
                                            placeholder="Tell us what you need..."
                                            className="w-full rounded-lg bg-white/90 text-gray-900 placeholder-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 resize-none"
                                        />
                                        {contactErrors.message && (
                                            <p className="mt-1 text-xs text-red-200">{contactErrors.message}</p>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={contactProcessing}
                                        className="inline-flex items-center justify-center gap-2 bg-white text-cyan-700 font-semibold px-6 py-2.5 rounded-lg hover:bg-cyan-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {contactProcessing ? (
                                            <LoaderCircle className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        {contactProcessing ? 'Sending...' : 'Send Message'}
                                    </button>
                                    {contactRecentlySuccessful && !contactProcessing && (
                                        <span className="ml-3 text-sm text-cyan-100">Message sent!</span>
                                    )}
                                </form>
                            </div>
                            {/* Map beside the form on large screens */}
                            <div className="lg:col-span-2 rounded-2xl overflow-hidden shadow-2xl border border-white/20 min-h-[300px]">
                                <iframe
                                    title="Mejeck IcePlant Location"
                                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3852.4!2d121.0027001!3d15.3529498!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTXCsDIxJzEwLjYiTiAxMjHCsDAwJzA5LjciRQ!5e0!3m2!1sen!2sph!4v1"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0, minHeight: '300px' }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                ></iframe>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-gray-900 dark:bg-slate-950 text-white py-12">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8">
                            <div className="min-w-0 md:col-span-3">
                                <div className="flex items-center mb-4">
                                    <img
                                        src="/images/LOGO.jpg"
                                        alt="Mejeck IcePlant Logo"
                                        className="w-8 h-8 rounded-lg object-cover mr-2"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                            const target = e.currentTarget;
                                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect fill='%2306b6d4' width='32' height='32' rx='6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23ffffff' font-family='Arial' font-size='12' font-weight='bold'%3EMI%3C/text%3E%3C/svg%3E";
                                        }}
                                    />
                                    <h3 className="text-xl font-bold text-white dark:text-white">Mejeck IcePlant</h3>
                                </div>
                                <p className="text-gray-400">Purified Ice Tubes for Perfect Chills - Your trusted partner for beverage ice solutions.</p>
                            </div>
                            <div className="min-w-0 md:col-span-2">
                                <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
                                <ul className="space-y-2 text-gray-400">
                                    <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                                    <li><a href="#products" className="hover:text-white transition-colors">Products</a></li>
                                    <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                                </ul>
                            </div>
                            <div className="min-w-0 md:col-span-3">
                                <h4 className="text-lg font-semibold mb-4">Our Products</h4>
                                <ul className="space-y-2 text-gray-400">
                                    <li><a href="#" className="hover:text-white transition-colors">Redhorse Beer</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">San Mig Light</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">San Mig Apple</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">San Mig Pilsen</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Purified Ice Tubes</a></li>
                                </ul>
                            </div>
                            <div className="min-w-0 md:col-span-4">
                                <h4 className="text-lg font-semibold mb-4">Contact Info</h4>
                                <ul className="space-y-2 text-gray-400">
                                    <li>+63 (968) 600-1910</li>
                                    <li>harrismanabat3@gmail.com</li>
                                    <li>
                                        <a
                                            href="https://www.google.com/maps/@15.3529498,121.0027001,15z"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-white transition-colors break-words leading-relaxed block"
                                        >
                                            Lacuna St. Pob. 2 Penaranda, Nueva Ecija
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-white/10 mt-8 pt-8 text-center text-gray-400">
                            <p>&copy; 2025 Mejeck IcePlant. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
                </div>

                {/* FAQ Modal */}
                {showFaqModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
                        <div className="w-full max-w-4xl mx-4 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-2xl rounded-2xl relative z-10 max-h-[90vh] flex flex-col">
                            <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                                            <HelpCircle className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowFaqModal(false)}
                                        className="bg-black text-white px-3 py-1.5 rounded-lg flex items-center hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Close
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 py-6 overflow-y-auto flex-1">
                                <div className="space-y-4">
                                    {faqs.map((faq, index) => (
                                        <div key={index} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <div className="flex items-center flex-1">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                                                        index % 3 === 0 ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300' :
                                                        index % 3 === 1 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' :
                                                        'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                                                    }`}>
                                                        <span className="font-bold text-sm">{index + 1}</span>
                                                    </div>
                                                    <h4 className={`font-semibold flex-1 ${
                                                        index % 3 === 0 ? 'text-cyan-900 dark:text-cyan-300' :
                                                        index % 3 === 1 ? 'text-blue-900 dark:text-blue-300' :
                                                        'text-indigo-900 dark:text-indigo-300'
                                                    }`}>{faq.question}</h4>
                                                </div>
                                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                                                    expandedFaq === index ? 'rotate-180' : ''
                                                }`} />
                                            </button>

                                            {expandedFaq === index && (
                                                <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600">
                                                    {faq.details && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 italic">{faq.details}</p>
                                                    )}
                                                    <p className="text-gray-700 dark:text-gray-200">{faq.answer}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
                                    <div className="text-center">
                                        <div className="relative inline-block">
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl blur-xl opacity-30"></div>
                                            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-slate-700">
                                                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mb-3 mx-auto">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Still have questions?</h3>
                                                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                                                    Can't find the answer you're looking for? We're here to help!
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                                    <a href="tel:+639686001910" className="inline-flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm">
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                        </svg>
                                                        Call Us Now
                                                    </a>
                                                    <a href="mailto:harrismanabat3@gmail.com" className="inline-flex items-center justify-center bg-white text-cyan-600 border-2 border-cyan-600 px-6 py-2 rounded-full font-semibold hover:bg-cyan-50 transition-all duration-300 transform hover:scale-105 text-sm">
                                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        Email Us
                                                    </a>
                                                    <button
                                                        onClick={() => setShowFaqModal(false)}
                                                        className="inline-flex items-center justify-center bg-white text-gray-600 border-2 border-gray-300 px-6 py-2 rounded-full font-semibold hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 text-sm"
                                                    >
                                                        <X className="w-4 h-4 mr-2" />
                                                        Close
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Product Modal — mirrors the Quick View modal customers see after logging in */}
                {showProductModal && selectedProduct && (() => {
                    const isBeverage = selectedProduct.name !== 'Purified Ice Tubes';
                    const units = getProductUnits(selectedProduct);
                    const selectedUnit = units[selectedUnitIndex] ?? units[0] ?? null;
                    const isCase = selectedUnitIndex === 0;

                    return (
                        <div
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                            onClick={() => setShowProductModal(false)}
                        >
                            <div
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="relative h-64 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 overflow-hidden rounded-t-2xl">
                                    <img
                                        src={selectedProduct.image}
                                        alt={selectedProduct.name}
                                        className="w-full h-full object-cover"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                            const target = e.currentTarget;
                                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='320' viewBox='0 0 400 320'%3E%3Crect fill='%23e0f2fe' width='400' height='320'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%230284c7' font-family='Arial' font-size='20'%3EProduct Image%3C/text%3E%3C/svg%3E";
                                        }}
                                    />
                                    <button
                                        onClick={() => setShowProductModal(false)}
                                        className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-md transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedProduct.category}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                                            selectedProduct.availability === 'In Stock' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            selectedProduct.availability === 'Limited Stock' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        }`}>
                                            {selectedProduct.availability}
                                        </span>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-300">{selectedProduct.description}</p>

                                    {isBeverage ? (() => {
                                        const pricing = beveragePrices[selectedProduct.name];
                                        if (!pricing) return null;
                                        const isCold = isCase && selectedCold;
                                        const unitPrice = isCase ? (isCold ? pricing.caseCold : pricing.case) : pricing.bottle;
                                        return (
                                            <div className="space-y-2.5">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Package Type: <span className="text-gray-900 dark:text-white">{isCase ? 'Case' : 'Bottle'}</span>
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedUnitIndex(0)}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            isCase
                                                                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 border-gray-900 dark:border-slate-100'
                                                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:border-gray-500'
                                                        }`}
                                                    >Case</button>
                                                    <button
                                                        onClick={() => { setSelectedUnitIndex(1); setSelectedCold(false); }}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            !isCase
                                                                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 border-gray-900 dark:border-slate-100'
                                                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:border-gray-500'
                                                        }`}
                                                    >Bottle</button>
                                                </div>
                                                {isCase && (
                                                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none w-fit">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCold}
                                                            onChange={(e) => setSelectedCold(e.target.checked)}
                                                            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-500 text-cyan-500 focus:ring-cyan-500"
                                                        />
                                                        Cold (+₱{(pricing.caseCold - pricing.case).toFixed(2)})
                                                    </label>
                                                )}
                                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                    ₱{unitPrice.toFixed(2)}
                                                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">/{isCase ? (isCold ? 'case (cold)' : 'case') : 'bottle'}</span>
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Qty:</span>
                                                    <QuantityInput
                                                        value={productQty}
                                                        onChange={setProductQty}
                                                        size="sm"
                                                        className="w-28 flex-shrink-0"
                                                        inputClassName="text-xs w-8"
                                                    />
                                                    <a
                                                        href="/login"
                                                        className={`flex-1 flex items-center justify-center gap-1 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white h-9 rounded-lg text-xs font-semibold transition-colors ${productQty <= 0 ? 'opacity-40 pointer-events-none' : ''}`}
                                                    >
                                                        <ShoppingCart className="w-3.5 h-3.5" />
                                                        Add to Cart
                                                    </a>
                                                    <a
                                                        href="/login"
                                                        className={`flex-1 flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white h-9 rounded-lg text-xs font-semibold transition-colors ${productQty <= 0 ? 'opacity-40 pointer-events-none' : ''}`}
                                                    >
                                                        <CreditCard className="w-3.5 h-3.5" />
                                                        Buy Now
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })() : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedUnitIndex}
                                                onChange={(e) => setSelectedUnitIndex(Number(e.target.value))}
                                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                            >
                                                {units.map((u, i) => (
                                                    <option key={u.label} value={i}>
                                                        {u.label} — ₱{u.price.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedUnit && (
                                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                                    ₱{selectedUnit.price.toFixed(2)}
                                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">/{selectedUnit.label}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Qty:</span>
                                                <QuantityInput
                                                    value={productQty}
                                                    onChange={(val) => setProductQty(Math.max(1, val))}
                                                    min={1}
                                                    className="flex-1"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <a
                                                    href="/login"
                                                    className="flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <ShoppingCart className="w-3.5 h-3.5" />
                                                    Add to Cart
                                                </a>
                                                <a
                                                    href="/login"
                                                    className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                    Buy Now
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </>
    );
}
