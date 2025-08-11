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
  Clock
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
      content: 'Hello! I\'m your AI Controller. I can help you manage your entire cold outreach operation. I can control campaigns, analyze performance, manage leads, configure channels, and optimize your sequences. What would you like me to help you with today?',
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
        "I understand you want to work on that. The AI Controller is currently under development and will soon be able to manage your entire outreach operation automatically.",
        "That's a great request! The AI Controller will be able to handle that task once it's fully deployed. For now, you can manage this manually in the respective sections.",
        "I see what you're trying to accomplish. The AI Controller is being trained to handle complex operations like this. Coming soon!",
        "Excellent idea! The AI Controller will have full access to manage campaigns, leads, sequences, and analytics. This feature is in active development."
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

  const quickActions = [
    { text: "Analyze my campaign performance", icon: BarChart3 },
    { text: "Optimize my outreach sequences", icon: Target },
    { text: "Find new high-intent leads", icon: Users },
    { text: "Schedule campaign activities", icon: Calendar },
    { text: "Configure communication channels", icon: Settings },
    { text: "Generate performance reports", icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          {theme === 'gold' ? (
            <Crown className="h-10 w-10 text-yellow-400" />
          ) : (
            <Bot className="h-10 w-10 text-blue-600" />
          )}
          <h1 className={`text-4xl font-bold ${
            theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
          }`}>
            AI Controller
          </h1>
        </div>
        <p className={`text-xl max-w-3xl mx-auto ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Your intelligent assistant for managing campaigns, leads, sequences, and analytics
        </p>
      </div>

      {/* Coming Soon Badge */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center px-6 py-3 rounded-full border-2 ${
          theme === 'gold'
            ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          <Clock className="h-5 w-5 mr-2" />
          <span className="font-semibold">Advanced Features Coming Soon</span>
        </div>
      </div>

      {/* Chat Interface */}
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Chat Header */}
        <div className={`p-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
            }`}>
              <Bot className={`h-6 w-6 ${
                theme === 'gold' ? 'text-black' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                AI Controller Chat
              </h2>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Preview of the intelligent assistant interface
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-600 text-white'
                    : theme === 'gold' ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-600'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className={`px-4 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-600 text-white'
                    : theme === 'gold' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' 
                      ? theme === 'gold' ? 'text-black/70' : 'text-blue-100'
                      : theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
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
              <div className="flex items-start space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  theme === 'gold' ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-600'
                }`}>
                  <Bot className="h-4 w-4" />
                </div>
                <div className={`px-4 py-2 rounded-lg ${
                  theme === 'gold' ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <div className="flex space-x-1">
                    <div className={`w-2 h-2 rounded-full animate-bounce ${
                      theme === 'gold' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`}></div>
                    <div className={`w-2 h-2 rounded-full animate-bounce ${
                      theme === 'gold' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} style={{ animationDelay: '0.1s' }}></div>
                    <div className={`w-2 h-2 rounded-full animate-bounce ${
                      theme === 'gold' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={`p-4 border-t ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className={`text-xs font-medium mb-3 ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Quick Actions (Preview):
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => setInputMessage(action.text)}
                  disabled={isTyping}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 text-gray-300 hover:bg-yellow-400/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-3 w-3 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                    }`} />
                    <span className="text-xs">{action.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask the AI Controller to manage your campaigns..."
              className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              } focus:border-transparent`}
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className={`px-4 py-2 rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className={`text-xs mt-2 ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            🚧 AI Controller is in development. Full automation capabilities coming soon!
          </p>
        </div>
      </div>

      {/* Capabilities Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: 'Campaign Management',
            description: 'Create, optimize, and manage campaigns automatically',
            icon: Target,
            features: ['Auto-optimization', 'Performance monitoring', 'A/B testing']
          },
          {
            title: 'Lead Intelligence',
            description: 'Discover, enrich, and score leads with AI',
            icon: Users,
            features: ['Intent detection', 'Lead scoring', 'Auto-enrichment']
          },
          {
            title: 'Sequence Optimization',
            description: 'AI-powered sequence building and timing',
            icon: MessageSquare,
            features: ['Smart timing', 'Channel selection', 'Message optimization']
          },
          {
            title: 'Performance Analytics',
            description: 'Deep insights and predictive analytics',
            icon: BarChart3,
            features: ['Predictive modeling', 'ROI optimization', 'Trend analysis']
          },
          {
            title: 'Channel Management',
            description: 'Automatic channel configuration and monitoring',
            icon: Settings,
            features: ['Auto-setup', 'Health monitoring', 'Failover handling']
          },
          {
            title: 'Smart Scheduling',
            description: 'Intelligent timing and frequency optimization',
            icon: Calendar,
            features: ['Timezone optimization', 'Frequency tuning', 'Response prediction']
          }
        ].map((capability, index) => {
          const Icon = capability.icon;
          return (
            <div
              key={index}
              className={`p-6 rounded-xl border transition-all duration-300 ${
                theme === 'gold'
                  ? 'black-card gold-border hover:gold-shadow'
                  : 'bg-white border-gray-200 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                }`}>
                  <Icon className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold mb-2 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {capability.title}
                  </h3>
                  <p className={`text-sm mb-3 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {capability.description}
                  </p>
                  <ul className="space-y-1">
                    {capability.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className={`flex items-center text-xs ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <Sparkles className={`h-3 w-3 mr-2 ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-500'
                        }`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Development Status */}
      <div className={`rounded-xl border p-8 text-center ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
        }`}>
          {theme === 'gold' ? (
            <Crown className="h-10 w-10 text-black" />
          ) : (
            <Zap className="h-10 w-10 text-blue-600" />
          )}
        </div>
        
        <h2 className={`text-2xl font-bold mb-4 ${
          theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
        }`}>
          AI Controller in Development
        </h2>
        
        <p className={`text-lg mb-6 max-w-2xl mx-auto ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          The AI Controller will be your central command center for managing all aspects of your cold outreach operation. 
          Chat with AI to control campaigns, analyze performance, and optimize results automatically.
        </p>

        <div className={`inline-flex items-center px-6 py-3 rounded-full ${
          theme === 'gold'
            ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          <Clock className="h-5 w-5 mr-2" />
          <span className="font-semibold">Full Release: Q2 2025</span>
        </div>
      </div>
    </div>
  );
}