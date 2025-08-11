import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Send, 
  Bot, 
  User, 
  Crown, 
  Zap, 
  MessageSquare,
  Sparkles,
  Settings,
  Target,
  BarChart3,
  Users,
  Calendar,
  Phone,
  Mail,
  Clock,
  Star,
  Cpu,
  Brain,
  Orbit
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export function Targeting() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to the future of cold outreach. Soon, you\'ll be able to control everything from here. Wait for the surprise... 🚀',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "The future is coming... You'll soon be able to control your entire outreach empire from this chat interface. 🌟",
        "Imagine managing thousands of leads, optimizing campaigns, and scaling to 100k+ monthly revenue - all through simple conversations with AI. Coming very soon! ⚡",
        "The surprise is bigger than you think. This chat will become your command center for everything. Stay tuned... 🎯",
        "Soon, you'll just tell me what you want to achieve, and I'll handle the rest - campaigns, leads, sequences, analytics, everything. The future is almost here! 🚀"
      ];

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${
      theme === 'gold' 
        ? 'bg-gradient-to-br from-black via-gray-900 to-black'
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
          theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-400'
        }`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse ${
          theme === 'gold' ? 'bg-purple-400' : 'bg-purple-400'
        }`} style={{ animationDelay: '1s' }}></div>
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-2xl opacity-30 animate-bounce ${
          theme === 'gold' ? 'bg-yellow-300' : 'bg-blue-300'
        }`} style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Futuristic Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className={`relative p-4 rounded-2xl ${
              theme === 'gold' ? 'gold-gradient' : 'bg-gradient-to-r from-blue-600 to-purple-600'
            }`}>
              <Brain className={`h-12 w-12 ${
                theme === 'gold' ? 'text-black' : 'text-white'
              }`} />
              <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${
                theme === 'gold' ? 'bg-yellow-300' : 'bg-blue-400'
              }`}>
                <Sparkles className={`h-3 w-3 ${
                  theme === 'gold' ? 'text-black' : 'text-white'
                }`} />
              </div>
            </div>
          </div>
          
          <h1 className={`text-5xl font-bold mb-4 ${
            theme === 'gold' 
              ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500 bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent'
          }`}>
            AI Controller
          </h1>
          
          <p className={`text-xl mb-8 ${
            theme === 'gold' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            You will be able to control everything from here
          </p>

          <div className={`inline-flex items-center px-8 py-4 rounded-full border-2 backdrop-blur-sm ${
            theme === 'gold'
              ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400'
              : 'border-blue-300/50 bg-blue-100/50 text-blue-700'
          }`}>
            <Clock className="h-6 w-6 mr-3" />
            <span className="text-lg font-semibold">Wait for the surprise...</span>
            <Star className="h-6 w-6 ml-3 animate-pulse" />
          </div>
        </div>

        {/* Chat Interface */}
        <div className={`rounded-2xl border backdrop-blur-sm shadow-2xl ${
          theme === 'gold' 
            ? 'bg-black/40 border-yellow-400/20' 
            : 'bg-white/70 border-blue-200/50'
        }`}>
          {/* Chat Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-blue-200/50'
          }`}>
            <div className="flex items-center space-x-4">
              <div className={`relative p-3 rounded-xl ${
                theme === 'gold' ? 'gold-gradient' : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}>
                <Bot className={`h-6 w-6 ${
                  theme === 'gold' ? 'text-black' : 'text-white'
                }`} />
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full animate-ping ${
                  theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-400'
                }`}></div>
              </div>
              <div>
                <h2 className={`text-xl font-bold ${
                  theme === 'gold' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  AI Controller Preview
                </h2>
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  The future of outreach management
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-md ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    message.sender === 'user' 
                      ? theme === 'gold' 
                        ? 'gold-gradient text-black' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : theme === 'gold' 
                        ? 'bg-gray-800 border border-yellow-400/30 text-yellow-400' 
                        : 'bg-gray-100 border border-blue-200 text-blue-600'
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>
                  <div className={`px-6 py-4 rounded-2xl backdrop-blur-sm ${
                    message.sender === 'user'
                      ? theme === 'gold' 
                        ? 'bg-yellow-400/20 border border-yellow-400/30 text-gray-100' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : theme === 'gold' 
                        ? 'bg-gray-800/80 border border-yellow-400/20 text-gray-200' 
                        : 'bg-white/80 border border-blue-200/50 text-gray-900'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className={`text-xs mt-2 opacity-70`}>
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    theme === 'gold' 
                      ? 'bg-gray-800 border border-yellow-400/30 text-yellow-400' 
                      : 'bg-gray-100 border border-blue-200 text-blue-600'
                  }`}>
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className={`px-6 py-4 rounded-2xl backdrop-blur-sm ${
                    theme === 'gold' 
                      ? 'bg-gray-800/80 border border-yellow-400/20' 
                      : 'bg-white/80 border border-blue-200/50'
                  }`}>
                    <div className="flex space-x-2">
                      <div className={`w-2 h-2 rounded-full animate-bounce ${
                        theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-600'
                      }`}></div>
                      <div className={`w-2 h-2 rounded-full animate-bounce ${
                        theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-600'
                      }`} style={{ animationDelay: '0.1s' }}></div>
                      <div className={`w-2 h-2 rounded-full animate-bounce ${
                        theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-600'
                      }`} style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className={`p-6 border-t backdrop-blur-sm ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-blue-200/50'
          }`}>
            <div className="flex space-x-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask the AI Controller anything..."
                className={`flex-1 px-6 py-4 border rounded-2xl focus:outline-none focus:ring-2 backdrop-blur-sm transition-all ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/30 text-gray-200 placeholder-gray-400 focus:ring-yellow-400/50'
                    : 'border-blue-300/50 bg-white/50 text-gray-900 placeholder-gray-500 focus:ring-blue-500/50'
                } focus:border-transparent`}
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className={`px-6 py-4 rounded-2xl transition-all transform hover:scale-105 ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover:shadow-lg hover:shadow-yellow-400/25'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/25'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className={`text-xs mt-3 text-center ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              🚀 The AI Controller is being built. Soon you'll control everything from here.
            </p>
          </div>
        </div>

        {/* Future Capabilities Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Campaign Automation',
              description: 'AI will create, optimize, and manage campaigns automatically',
              icon: Target,
              color: theme === 'gold' ? 'from-yellow-400 to-yellow-600' : 'from-blue-500 to-blue-700'
            },
            {
              title: 'Lead Intelligence',
              description: 'Discover and score leads with advanced AI algorithms',
              icon: Users,
              color: theme === 'gold' ? 'from-purple-400 to-purple-600' : 'from-purple-500 to-purple-700'
            },
            {
              title: 'Smart Analytics',
              description: 'Predictive insights and performance optimization',
              icon: BarChart3,
              color: theme === 'gold' ? 'from-green-400 to-green-600' : 'from-green-500 to-green-700'
            },
            {
              title: 'Sequence Mastery',
              description: 'AI-powered sequence building and optimization',
              icon: MessageSquare,
              color: theme === 'gold' ? 'from-blue-400 to-blue-600' : 'from-indigo-500 to-indigo-700'
            },
            {
              title: 'Channel Control',
              description: 'Automatic channel management and optimization',
              icon: Settings,
              color: theme === 'gold' ? 'from-orange-400 to-orange-600' : 'from-orange-500 to-orange-700'
            },
            {
              title: 'Revenue Engine',
              description: 'Scale to 100k+ monthly revenue with AI guidance',
              icon: Zap,
              color: theme === 'gold' ? 'from-red-400 to-red-600' : 'from-red-500 to-red-700'
            }
          ].map((capability, index) => {
            const Icon = capability.icon;
            return (
              <div
                key={index}
                className={`group p-6 rounded-2xl border backdrop-blur-sm transition-all duration-500 hover:scale-105 ${
                  theme === 'gold'
                    ? 'bg-black/20 border-yellow-400/20 hover:border-yellow-400/40 hover:bg-yellow-400/5'
                    : 'bg-white/30 border-blue-200/30 hover:border-blue-300/50 hover:bg-white/50'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${capability.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${
                  theme === 'gold' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {capability.title}
                </h3>
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {capability.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <div className="mt-16 text-center">
          <div className={`inline-flex items-center space-x-3 px-8 py-4 rounded-full backdrop-blur-sm ${
            theme === 'gold'
              ? 'bg-gradient-to-r from-yellow-400/20 to-purple-400/20 border border-yellow-400/30'
              : 'bg-gradient-to-r from-blue-100/50 to-purple-100/50 border border-blue-300/50'
          }`}>
            <Orbit className={`h-6 w-6 animate-spin ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <span className={`text-lg font-bold ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
            }`}>
              Revolutionary Features Loading...
            </span>
            <Cpu className={`h-6 w-6 animate-pulse ${
              theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
            }`} />
          </div>
        </div>
      </div>
    </div>
  );
}