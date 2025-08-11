import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, 
  Phone, 
  MessageSquare, 
  Target, 
  TrendingUp, 
  Calendar,
  Crown,
  Zap,
  Users,
  CheckCircle,
  ChevronDown,
  Filter,
  BarChart,
  LineChart,
  Mail,
  Eye,
  MousePointer,
  Reply
} from 'lucide-react';

interface CampaignAnalyticsProps {
  campaignId: string;
}

interface EmailMetrics {
  totalEmails: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bookingRate: number;
}

interface CallMetrics {
  totalCalls: number;
  callsAnswered: number;
  callDuration: number;
  replyRate: number;
  bookingRate: number;
}

interface CampaignChannels {
  hasEmail: boolean;
  hasVoice: boolean;
  hasSMS: boolean;
  hasWhatsApp: boolean;
}

interface AnalyticsData {
  totalLeads: number;
  callsMade: number;
  smssSent: number;
  whatsappSent: number;
  emailsSent: number;
  bookings: number;
  responseRate: number;
  replies: number;
  emailMetrics: EmailMetrics;
  callMetrics: CallMetrics;
  campaignChannels: CampaignChannels;
  dailyActivity: Array<{
    date: string;
    calls: number;
    sms: number;
    whatsapp: number;
    emails: number;
  }>;
}

export function CampaignAnalytics({ campaignId }: CampaignAnalyticsProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalLeads: 0,
    callsMade: 0,
    smssSent: 0,
    whatsappSent: 0,
    emailsSent: 0,
    bookings: 0,
    responseRate: 0,
    replies: 0,
    emailMetrics: {
      totalEmails: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      emailsReplied: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bookingRate: 0
    },
    callMetrics: {
      totalCalls: 0,
      callsAnswered: 0,
      callDuration: 0,
      replyRate: 0,
      bookingRate: 0
    },
    campaignChannels: {
      hasEmail: false,
      hasVoice: false,
      hasSMS: false,
      hasWhatsApp: false
    },
    dailyActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    if (campaignId) {
      fetchAnalytics();
    }
  }, [campaignId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      // Calculate date range
      const now = new Date();
      let queryStartDate = new Date();
      
      if (timeRange === '7d') {
        queryStartDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30d') {
        queryStartDate.setDate(now.getDate() - 30);
      } else if (timeRange === 'custom' && startDate && endDate) {
        queryStartDate = new Date(startDate);
      } else {
        queryStartDate = new Date('2020-01-01'); // All time
      }

      const queryEndDate = timeRange === 'custom' && endDate ? new Date(endDate) : now;

      // First, determine what channels this campaign uses
      const { data: campaignSequences, error: sequencesError } = await supabase
        .from('campaign_sequences')
        .select('type')
        .eq('campaign_id', campaignId);

      if (sequencesError) throw sequencesError;

      const channelTypes = new Set(campaignSequences?.map(s => s.type) || []);
      const campaignChannels = {
        hasEmail: channelTypes.has('email'),
        hasVoice: channelTypes.has('call') || channelTypes.has('voice'),
        hasSMS: channelTypes.has('sms'),
        hasWhatsApp: channelTypes.has('whatsapp')
      };
      // Fetch total leads for this campaign
      const { data: leadsData, error: leadsError } = await supabase
        .from('uploaded_leads')
        .select('id')
        .eq('campaign_id', campaignId)
        .gte('created_at', queryStartDate.toISOString())
        .lte('created_at', queryEndDate.toISOString());

      if (leadsError) throw leadsError;

      // Fetch data based on campaign channels
      let conversationData: any[] = [];
      let emailTrackingData: any[] = [];
      let emailsSentFromActivity = 0;
      
      // Always fetch conversation history
      const { data: convData, error: conversationError } = await supabase
        .from('conversation_history')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('timestamp', queryStartDate.toISOString())
        .lte('timestamp', queryEndDate.toISOString());

      if (conversationError) throw conversationError;
      conversationData = convData || [];

      // For email campaigns, fetch email tracking data
      if (campaignChannels.hasEmail) {
        const { data: emailData, error: emailError } = await supabase
          .from('email_tracking')
          .select(`
            *,
            email_events (
              event_type,
              timestamp
            )
          `)
          .eq('campaign_id', campaignId)
          .gte('sent_at', queryStartDate.toISOString())
          .lte('sent_at', queryEndDate.toISOString());

        if (emailError) {
          console.warn('Email tracking data not available:', emailError);
          // Fallback to activity history for email count
          const { data: emailActivityData } = await supabase
            .from('lead_activity_history')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('type', 'email')
            .gte('executed_at', queryStartDate.toISOString())
            .lte('executed_at', queryEndDate.toISOString());
          
          emailsSentFromActivity = emailActivityData?.length || 0;
        } else {
          emailTrackingData = emailData || [];
        }
      }
      
      // Fetch replies (inbound messages)
      const { data: repliesData, error: repliesError } = await supabase
        .from('conversation_history')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('from_role', 'lead')
        .gte('timestamp', queryStartDate.toISOString())
        .lte('timestamp', queryEndDate.toISOString());

      if (repliesError) throw repliesError;
      
      // Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('campaign_id', campaignId)
        .gte('created_at', queryStartDate.toISOString())
        .lte('created_at', queryEndDate.toISOString());

      if (bookingsError) throw bookingsError;

      // Process data
      const callsMade = conversationData?.filter(c => c.channel === 'vapi' && c.from_role === 'ai').length || 0;
      const smssSent = conversationData?.filter(c => c.channel === 'sms' && c.from_role === 'ai').length || 0;
      const whatsappSent = conversationData?.filter(c => c.channel === 'whatsapp' && c.from_role === 'ai').length || 0;
      const emailsSent = emailTrackingData?.length || emailsSentFromActivity || 
        conversationData?.filter(c => c.channel === 'email' && c.from_role === 'ai').length || 0;
      const replies = repliesData?.length || 0;
      const totalOutbound = callsMade + smssSent + whatsappSent + emailsSent;
      const responseRate = totalOutbound > 0 ? (replies / totalOutbound) * 100 : 0;

      // Calculate email-specific metrics
      const emailMetrics: EmailMetrics = {
        totalEmails: emailsSent,
        emailsOpened: 0,
        emailsClicked: 0,
        emailsReplied: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bookingRate: 0
      };

      if (emailTrackingData && emailTrackingData.length > 0) {
        // Count unique opens, clicks, and replies
        const emailsWithOpens = new Set();
        const emailsWithClicks = new Set();
        const emailsWithReplies = new Set();

        emailTrackingData.forEach(email => {
          if (email.email_events && Array.isArray(email.email_events)) {
            email.email_events.forEach((event: any) => {
              switch (event.event_type) {
                case 'open':
                  emailsWithOpens.add(email.tracking_id);
                  break;
                case 'click':
                  emailsWithClicks.add(email.tracking_id);
                  break;
                case 'reply':
                  emailsWithReplies.add(email.tracking_id);
                  break;
              }
            });
          }
        });

        emailMetrics.emailsOpened = emailsWithOpens.size;
        emailMetrics.emailsClicked = emailsWithClicks.size;
        emailMetrics.emailsReplied = emailsWithReplies.size;
        emailMetrics.openRate = emailsSent > 0 ? (emailMetrics.emailsOpened / emailsSent) * 100 : 0;
        emailMetrics.clickRate = emailsSent > 0 ? (emailMetrics.emailsClicked / emailsSent) * 100 : 0;
        emailMetrics.replyRate = emailsSent > 0 ? (emailMetrics.emailsReplied / emailsSent) * 100 : 0;
        emailMetrics.bookingRate = emailsSent > 0 ? (bookingsData?.length || 0 / emailsSent) * 100 : 0;
      } else if (campaignChannels.hasEmail && emailsSent > 0) {
        // Fallback: calculate email replies from conversation history
        const emailReplies = conversationData?.filter(c => 
          c.channel === 'email' && c.from_role === 'lead'
        ).length || 0;
        
        emailMetrics.emailsReplied = emailReplies;
        emailMetrics.replyRate = emailsSent > 0 ? (emailReplies / emailsSent) * 100 : 0;
        emailMetrics.bookingRate = emailsSent > 0 ? ((bookingsData?.length || 0) / emailsSent) * 100 : 0;
      }

      // Calculate call-specific metrics
      const callMetrics: CallMetrics = {
        totalCalls: callsMade,
        callsAnswered: conversationData?.filter(c => 
          c.channel === 'vapi' && c.from_role === 'lead'
        ).length || 0,
        callDuration: 0, // Would need to calculate from call records
        replyRate: callsMade > 0 ? (replies / callsMade) * 100 : 0,
        bookingRate: callsMade > 0 ? (bookingsData?.length || 0 / callsMade) * 100 : 0
      };
      // Generate daily activity data
      let daysToShow = 7;
      if (timeRange === '30d') {
        daysToShow = 30;
      } else if (timeRange === 'custom' && startDate && endDate) {
        daysToShow = Math.min(Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1, 90);
      } else if (timeRange === 'all') {
        daysToShow = 30; // Limit to last 30 days for performance
      }
      
      const dailyActivity = [];
      const baseDate = timeRange === 'custom' && startDate ? new Date(startDate) : now;
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date();
        if (timeRange === 'custom' && startDate) {
          date.setTime(baseDate.getTime() + (daysToShow - 1 - i) * 24 * 60 * 60 * 1000);
        } else {
        date.setDate(date.getDate() - i);
        }
        const dateStr = date.toISOString().split('T')[0];
        
        const dayConversations = conversationData?.filter(c => 
          c.timestamp.startsWith(dateStr) && c.from_role === 'ai'
        ) || [];

        dailyActivity.push({
          date: dateStr,
          calls: dayConversations.filter(c => c.channel === 'vapi').length,
          sms: dayConversations.filter(c => c.channel === 'sms').length,
          whatsapp: dayConversations.filter(c => c.channel === 'whatsapp').length,
          emails: emailTrackingData?.filter(e => e.sent_at?.startsWith(dateStr)).length || 0,
        });
      }

      setAnalytics({
        totalLeads: leadsData?.length || 0,
        callsMade,
        smssSent,
        whatsappSent,
        emailsSent,
        bookings: bookingsData?.length || 0,
        responseRate,
        replies,
        emailMetrics,
        callMetrics,
        campaignChannels,
        dailyActivity
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxDailyValue = Math.max(
    ...analytics.dailyActivity.map(day => 
      Math.max(day.calls, day.sms, day.whatsapp, day.emails)
    ),
    1
  );

  if (loading) {
    return (
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="animate-pulse">
          <div className={`h-4 rounded mb-4 ${
            theme === 'gold' ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`h-20 rounded ${
                theme === 'gold' ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            ))}
          </div>
          <div className={`h-64 rounded ${
            theme === 'gold' ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Key Metrics Based on Campaign Channels */}
      {analytics.campaignChannels.hasEmail ? (
        /* Email Campaign Metrics */
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Leads */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Users className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Total Leads
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.totalLeads}
            </p>
          </div>

          {/* Emails Sent */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Mail className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Emails Sent
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
            }`}>
              {analytics.emailMetrics.totalEmails}
            </p>
          </div>

          {/* Open Rate */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Eye className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Open Rate
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.emailMetrics.openRate.toFixed(1)}%
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.emailMetrics.emailsOpened} opened
            </p>
          </div>

          {/* Click Rate */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <MousePointer className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Click Rate
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
            }`}>
              {analytics.emailMetrics.clickRate.toFixed(1)}%
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.emailMetrics.emailsClicked} clicked
            </p>
          </div>

          {/* Reply Rate */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Reply className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Reply Rate
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
            }`}>
              {analytics.emailMetrics.replyRate.toFixed(1)}%
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.emailMetrics.emailsReplied} replied
            </p>
          </div>
        </div>
      ) : analytics.campaignChannels.hasVoice ? (
        /* Voice Campaign Metrics */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Leads */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Users className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Total Leads
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.totalLeads}
            </p>
          </div>

          {/* Calls Made */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Phone className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Calls Made
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
            }`}>
              {analytics.callMetrics.totalCalls}
            </p>
          </div>

          {/* Calls Answered */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <CheckCircle className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Answer Rate
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.callMetrics.totalCalls > 0 ? 
                ((analytics.callMetrics.callsAnswered / analytics.callMetrics.totalCalls) * 100).toFixed(1) : 0}%
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.callMetrics.callsAnswered} answered
            </p>
          </div>

          {/* Bookings */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Calendar className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Bookings
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
            }`}>
              {analytics.bookings}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.callMetrics.bookingRate.toFixed(1)}% rate
            </p>
          </div>
        </div>
      ) : (
        /* Multi-Channel or SMS/WhatsApp Campaign Metrics */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Leads */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Users className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Total Leads
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.totalLeads}
            </p>
          </div>

          {/* Messages Sent */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <MessageSquare className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Messages Sent
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
            }`}>
              {analytics.callsMade + analytics.smssSent + analytics.whatsappSent + analytics.emailsSent}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              All channels
            </p>
          </div>

          {/* Replies */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Reply className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Replies
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
            }`}>
              {analytics.replies}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.responseRate.toFixed(1)}% rate
            </p>
          </div>

          {/* Bookings */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center">
              <Calendar className={`h-5 w-5 mr-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
              }`} />
              <span className={`text-sm font-medium ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Bookings
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
            }`}>
              {analytics.bookings}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {analytics.totalLeads > 0 ? ((analytics.bookings / analytics.totalLeads) * 100).toFixed(1) : 0}% rate
            </p>
          </div>
        </div>
      )}

      {/* Activity Chart */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h4 className={`text-md font-semibold mb-4 sm:mb-0 ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Daily Activity
          </h4>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Time Range Selector */}
            <div className="flex rounded-lg overflow-hidden border">
              {(['7d', '30d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    timeRange === range
                      ? theme === 'gold'
                        ? 'gold-gradient text-black'
                        : 'bg-blue-600 text-white'
                      : theme === 'gold'
                        ? 'text-gray-400 hover:bg-gray-800'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
                </button>
              ))}
            </div>
            
            {/* Chart Type Selector */}
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  chartType === 'bar'
                    ? theme === 'gold'
                      ? 'gold-gradient text-black'
                      : 'bg-blue-600 text-white'
                    : theme === 'gold'
                      ? 'text-gray-400 hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Bar Chart"
              >
                <BarChart className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  chartType === 'line'
                    ? theme === 'gold'
                      ? 'gold-gradient text-black'
                      : 'bg-blue-600 text-white'
                    : theme === 'gold'
                      ? 'text-gray-400 hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Line Chart"
              >
                <LineChart className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Chart Container */}
        <div className="relative">
          {chartType === 'bar' ? (
            /* Bar Chart */
            <div className="space-y-1">
              <div className="flex justify-between items-end h-64 px-2">
                {analytics.dailyActivity.map((day, index) => {
                  const total = day.calls + day.sms + day.whatsapp + day.emails;
                  const date = new Date(day.date);
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayDate = date.toLocaleDateString('en-US', { day: 'numeric' });
                  const maxHeight = 200; // Max height in pixels
                  
                  return (
                    <div key={index} className="flex flex-col items-center space-y-2 flex-1 max-w-16">
                      {/* Bar */}
                      <div className="relative flex flex-col justify-end h-48 w-8">
                        {/* Calls */}
                        {day.calls > 0 && (
                          <div
                            className={`w-full rounded-t-sm ${
                              theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-500'
                            } transition-all duration-300 hover:opacity-80`}
                            style={{
                              height: `${(day.calls / maxDailyValue) * maxHeight}px`,
                              minHeight: day.calls > 0 ? '2px' : '0'
                            }}
                            title={`${day.calls} calls`}
                          />
                        )}
                        
                        {/* SMS */}
                        {day.sms > 0 && (
                          <div
                            className={`w-full ${
                              day.calls === 0 ? 'rounded-t-sm' : ''
                            } ${day.whatsapp === 0 ? 'rounded-b-sm' : ''} ${
                              theme === 'gold' ? 'bg-yellow-600' : 'bg-green-500'
                            } transition-all duration-300 hover:opacity-80`}
                            style={{
                              height: `${(day.sms / maxDailyValue) * maxHeight}px`,
                              minHeight: day.sms > 0 ? '2px' : '0'
                            }}
                            title={`${day.sms} SMS`}
                          />
                        )}
                        
                        {/* WhatsApp */}
                        {day.whatsapp > 0 && (
                          <div
                            className={`w-full rounded-b-sm ${
                              theme === 'gold' ? 'bg-orange-400' : 'bg-purple-500'
                            } transition-all duration-300 hover:opacity-80`}
                            style={{
                              height: `${(day.whatsapp / maxDailyValue) * maxHeight}px`,
                              minHeight: day.whatsapp > 0 ? '2px' : '0'
                            }}
                            title={`${day.whatsapp} WhatsApp`}
                          />
                        )}
                        
                        {/* Emails */}
                        {day.emails > 0 && (
                          <div
                            className={`w-full ${
                              day.whatsapp === 0 ? 'rounded-b-sm' : ''
                            } ${
                              theme === 'gold' ? 'bg-purple-400' : 'bg-indigo-500'
                            } transition-all duration-300 hover:opacity-80`}
                            style={{
                              height: `${(day.emails / maxDailyValue) * maxHeight}px`,
                              minHeight: day.emails > 0 ? '2px' : '0'
                            }}
                            title={`${day.emails} Emails`}
                          />
                        )}
                        
                        {/* Empty state */}
                        {total === 0 && (
                          <div className={`w-full h-1 rounded-sm ${
                            theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
                          }`} />
                        )}
                        
                        {/* Total count label */}
                        {total > 0 && (
                          <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {total}
                          </div>
                        )}
                      </div>
                      
                      {/* Date label */}
                      <div className="text-center">
                        <div className={`text-xs font-medium ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {dayName}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {dayDate}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Line Chart */
            <div className="relative h-64">
              <svg className="w-full h-full" viewBox="0 0 800 200">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <line
                    key={i}
                    x1="40"
                    y1={40 + (i * 32)}
                    x2="760"
                    y2={40 + (i * 32)}
                    stroke={theme === 'gold' ? '#374151' : '#e5e7eb'}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ))}
                
                {/* Y-axis labels */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <text
                    key={i}
                    x="35"
                    y={45 + (i * 32)}
                    textAnchor="end"
                    className={`text-xs ${theme === 'gold' ? 'fill-gray-400' : 'fill-gray-600'}`}
                  >
                    {Math.round((maxDailyValue / 4) * (4 - i))}
                  </text>
                ))}
                
                {/* Data lines */}
                {analytics.dailyActivity.length > 1 && (
                  <>
                    {/* Calls line */}
                    <polyline
                      fill="none"
                      stroke={theme === 'gold' ? '#facc15' : '#3b82f6'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={analytics.dailyActivity.map((day, index) => {
                        const x = 40 + (index * (720 / (analytics.dailyActivity.length - 1)));
                        const y = 168 - ((day.calls / maxDailyValue) * 128);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* SMS line */}
                    <polyline
                      fill="none"
                      stroke={theme === 'gold' ? '#ca8a04' : '#22c55e'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={analytics.dailyActivity.map((day, index) => {
                        const x = 40 + (index * (720 / (analytics.dailyActivity.length - 1)));
                        const y = 168 - ((day.sms / maxDailyValue) * 128);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* WhatsApp line */}
                    <polyline
                      fill="none"
                      stroke={theme === 'gold' ? '#fb923c' : '#a855f7'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={analytics.dailyActivity.map((day, index) => {
                        const x = 40 + (index * (720 / (analytics.dailyActivity.length - 1)));
                        const y = 168 - ((day.whatsapp / maxDailyValue) * 128);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* Data points */}
                    {analytics.dailyActivity.map((day, index) => {
                      const x = 40 + (index * (720 / (analytics.dailyActivity.length - 1)));
                      const total = day.calls + day.sms + day.whatsapp;
                      
                      return (
                        <g key={index}>
                          {/* Calls point */}
                          {day.calls > 0 && (
                            <circle
                              cx={x}
                              cy={168 - ((day.calls / maxDailyValue) * 128)}
                              r="4"
                              fill={theme === 'gold' ? '#facc15' : '#3b82f6'}
                              className="hover:r-6 transition-all cursor-pointer"
                            >
                              <title>{`${day.calls} calls`}</title>
                            </circle>
                          )}
                          
                          {/* SMS point */}
                          {day.sms > 0 && (
                            <circle
                              cx={x}
                              cy={168 - ((day.sms / maxDailyValue) * 128)}
                              r="4"
                              fill={theme === 'gold' ? '#ca8a04' : '#22c55e'}
                              className="hover:r-6 transition-all cursor-pointer"
                            >
                              <title>{`${day.sms} SMS`}</title>
                            </circle>
                          )}
                          
                          {/* WhatsApp point */}
                          {day.whatsapp > 0 && (
                            <circle
                              cx={x}
                              cy={168 - ((day.whatsapp / maxDailyValue) * 128)}
                              r="4"
                              fill={theme === 'gold' ? '#fb923c' : '#a855f7'}
                              className="hover:r-6 transition-all cursor-pointer"
                            >
                              <title>{`${day.whatsapp} WhatsApp`}</title>
                            </circle>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}
                
                {/* X-axis labels */}
                {analytics.dailyActivity.map((day, index) => {
                  const x = 40 + (index * (720 / Math.max(analytics.dailyActivity.length - 1, 1)));
                  const date = new Date(day.date);
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayDate = date.toLocaleDateString('en-US', { day: 'numeric' });
                  
                  return (
                    <g key={index}>
                      <text
                        x={x}
                        y="190"
                        textAnchor="middle"
                        className={`text-xs ${theme === 'gold' ? 'fill-gray-400' : 'fill-gray-600'}`}
                      >
                        {dayName}
                      </text>
                      <text
                        x={x}
                        y="200"
                        textAnchor="middle"
                        className={`text-xs ${theme === 'gold' ? 'fill-gray-500' : 'fill-gray-500'}`}
                      >
                        {dayDate}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          
          {/* Legend */}
          <div className="flex justify-center space-x-6 mt-4">
            <div className={`flex items-center text-xs ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-500'
              }`} />
              Calls
            </div>
            <div className={`flex items-center text-xs ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                theme === 'gold' ? 'bg-yellow-600' : 'bg-green-500'
              }`} />
              SMS
            </div>
            <div className={`flex items-center text-xs ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                theme === 'gold' ? 'bg-orange-400' : 'bg-purple-500'
              }`} />
              WhatsApp
            </div>
            <div className={`flex items-center text-xs ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                theme === 'gold' ? 'bg-purple-400' : 'bg-indigo-500'
              }`} />
              Email
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Progress */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <h4 className={`text-md font-semibold mb-4 ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Campaign Progress
        </h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Leads Contacted
            </span>
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              {analytics.callsMade + analytics.smssSent + analytics.whatsappSent + analytics.emailsSent} / {analytics.totalLeads}
            </span>
          </div>
          
          <div className={`w-full bg-gray-200 rounded-full h-2 ${
            theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div
              className={`h-2 rounded-full ${
                theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
              }`}
              style={{
                width: `${analytics.totalLeads > 0 
                  ? ((analytics.callsMade + analytics.smssSent + analytics.whatsappSent + analytics.emailsSent) / analytics.totalLeads) * 100 
                  : 0}%`
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-sm ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Conversion to Bookings
            </span>
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
            }`}>
              {analytics.totalLeads > 0 ? ((analytics.bookings / analytics.totalLeads) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}