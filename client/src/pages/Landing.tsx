import { useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle,
  Ruler,
  Square,
  Hash,
  FileText,
  Zap,
  Shield,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import logo from '../assets/logo.png';
import headerLogo from '../assets/headerlogo.png';

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Ruler className="w-6 h-6" />,
      title: 'Linear Measurements',
      description: 'Measure walls, trim, and linear elements with precision. Click to draw lines and get instant footage calculations.',
    },
    {
      icon: <Square className="w-6 h-6" />,
      title: 'Area Takeoffs',
      description: 'Calculate square footage for flooring, roofing, and more. Draw polygons and get accurate area measurements.',
    },
    {
      icon: <Hash className="w-6 h-6" />,
      title: 'Count Items',
      description: 'Count doors, windows, fixtures, and any repeating elements. Simply click to count and track quantities.',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Professional Reports',
      description: 'Export detailed PDF reports with your branding. Share takeoffs with clients and team members.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Calculations',
      description: 'Real-time totals with waste factor adjustments. See running totals as you measure.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Accurate Scaling',
      description: 'Calibrate to any scale with presets or custom input. Supports architectural and engineering scales.',
    },
  ];

  const benefits = [
    'No software installation required',
    'Works with any PDF plan',
    'Supports multiple measurement types',
    'Automatic waste factor calculations',
    'Professional PDF exports',
    'Organize by category and tool',
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src={headerLogo} alt="TakeoffPro" className="h-20 w-auto" />
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="btn btn-primary"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        {/* Background Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={logo}
            alt=""
            className="w-[800px] h-auto opacity-[0.03]"
          />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  <Zap className="w-4 h-4" />
                  Fast & Accurate Takeoffs
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                  Construction Takeoffs
                  <span className="block text-primary-600">Made Simple</span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Professional plan takeoff software for contractors and estimators.
                  Upload your PDF plans and start measuring in seconds.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/signup')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/25 hover:shadow-xl hover:shadow-primary-600/30"
                >
                  Try it FREE
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => document.getElementById('demo-video')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 rounded-xl font-semibold text-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                {benefits.slice(0, 4).map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-slate-600">
                    <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - App Preview */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
                {/* Browser Chrome */}
                <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white rounded-md px-3 py-1 text-sm text-slate-400 text-center">
                      takeoffpro.app
                    </div>
                  </div>
                </div>
                {/* App Screenshot / Video Placeholder */}
                <div id="demo-video" className="aspect-[4/3] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto cursor-pointer hover:bg-white/20 transition-colors group">
                      <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-white/60 text-sm">Click to watch demo</p>
                  </div>
                </div>
              </div>

              {/* Floating Stats */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg border border-slate-200 p-4 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Ruler className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">2,450</p>
                    <p className="text-sm text-slate-500">Linear Feet</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 animate-float-delayed">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Square className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">8,200</p>
                    <p className="text-sm text-slate-500">Square Feet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Everything You Need for Accurate Takeoffs
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Professional-grade tools designed for contractors, estimators, and construction professionals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 rounded-2xl border border-slate-200 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-600/5 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600 mb-6 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-slate-600">
              Three simple steps to accurate construction takeoffs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Plans',
                description: 'Simply drag and drop your PDF construction plans into the app.',
              },
              {
                step: '02',
                title: 'Set Your Scale',
                description: 'Calibrate the scale using known dimensions or select from presets.',
              },
              {
                step: '03',
                title: 'Start Measuring',
                description: 'Use our tools to measure linear, area, and count quantities.',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-8xl font-bold text-slate-200 absolute -top-4 -left-2">
                  {item.step}
                </div>
                <div className="relative bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-slate-600">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ChevronRight className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary-600 to-primary-700 relative overflow-hidden">
        {/* Background Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={logo}
            alt=""
            className="w-[600px] h-auto opacity-10 brightness-0 invert"
          />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Streamline Your Takeoffs?
          </h2>
          <p className="text-xl text-primary-100 mb-10">
            Join contractors who are saving time and improving accuracy with TakeoffPro.
          </p>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-primary-600 rounded-xl font-semibold text-lg hover:bg-primary-50 transition-all shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="mt-6 text-primary-200 text-sm">
            No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="TakeoffPro" className="h-14 w-auto brightness-0 invert" />
              <span className="text-lg font-semibold text-white">TakeoffPro</span>
            </div>
            <p className="text-slate-400 text-sm">
              Professional construction takeoff software for modern contractors.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
